import { app, BrowserWindow, ipcMain, session } from 'electron';
import { join, dirname } from 'node:path';
import { mkdirSync, appendFileSync } from 'node:fs';
import { getOrCreateConfig, markFirstRunComplete } from './config-manager';
import { spawnProcess, waitForPort, killAll, getResourcesPath } from './process-manager';

// ---------------------------------------------------------------------------
// File logging — writes to ~/Library/Logs/Open Query/main.log
// Done with plain fs so it works reliably inside the asar without depending
// on package-export resolution (which breaks electron-log inside asars).
// ---------------------------------------------------------------------------
function setupLogging(): void {
  try {
    const logDir = join(app.getPath('logs'), 'Open Query');
    mkdirSync(logDir, { recursive: true });
    const logFile = join(logDir, 'main.log');
    const write = (level: string, ...args: unknown[]) => {
      const line = `[${new Date().toISOString()}] ${level} ${args.map(String).join(' ')}\n`;
      appendFileSync(logFile, line);
    };
    const origLog = console.log.bind(console);
    const origErr = console.error.bind(console);
    console.log = (...a) => { write('INFO ', ...a); origLog(...a); };
    console.error = (...a) => { write('ERROR', ...a); origErr(...a); };
    console.log('Log file:', logFile);
  } catch (_) {
    // if logging setup fails, continue without file logging
  }
}

// Run after app is ready so app.getPath('logs') is available
app.whenReady().then(setupLogging).catch(() => void 0);

console.log('Open Query main process starting, version:', app.getVersion());

const API_PORT = 3001;
const WEB_PORT = 3000;

// Single-instance lock — focus existing window if duplicate launch
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadURL(`http://localhost:${WEB_PORT}`);
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.on('ready', async () => {
  try {
    // Clear HTTP cache so the renderer always fetches fresh content from the
    // local Next.js server rather than stale data from a previous session.
    await session.defaultSession.clearCache();
    console.log('Session cache cleared');

    // Log every HTTP request/response so we can see what the renderer fetches.
    session.defaultSession.webRequest.onCompleted((details) => {
      console.log(`[net] ${details.statusCode} ${details.method} ${details.url}`);
    });

    const config = getOrCreateConfig();
    const resourcesPath = getResourcesPath();
    const userData = app.getPath('userData');

    console.log('Starting — resourcesPath:', resourcesPath);
    console.log('Starting — userData:', userData);

    // ELECTRON_RUN_AS_NODE=1 tells the Electron binary to act as plain Node.js,
    // bypassing the app.asar. Without this, Electron finds the asar, launches
    // the packaged app again, hits the single-instance lock, and immediately exits.
    const nodeEnv = { ELECTRON_RUN_AS_NODE: '1' };

    // Spawn API server
    spawnProcess({
      executable: process.execPath,
      args: [join(resourcesPath, 'api-bundle', 'server.bundle.js')],
      env: {
        ...nodeEnv,
        MASTER_KEY: config.masterKey,
        DATABASE_URL: `file:${join(userData, 'openquery.db')}`,
        MIGRATIONS_PATH: join(resourcesPath, 'migrations'),
        API_HOST: '127.0.0.1',
        NODE_ENV: 'production',
        // esbuild leaves import.meta empty in CJS bundles, so the fallback
        // resolve(dirname(fileURLToPath(import.meta.url)), ...) would crash.
        // PROJECT_ROOT_OVERRIDE bypasses that code path entirely.
        PROJECT_ROOT_OVERRIDE: resourcesPath,
      },
    });

    // Spawn Next.js standalone server.
    // In a pnpm monorepo the standalone output nests the server at apps/web/server.js.
    spawnProcess({
      executable: process.execPath,
      args: [join(resourcesPath, 'web', 'apps', 'web', 'server.js')],
      env: {
        ...nodeEnv,
        PORT: String(WEB_PORT),
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
      },
    });

    console.log('Waiting for servers on ports', API_PORT, WEB_PORT);

    // Wait for both servers to accept TCP connections before opening the window
    await Promise.all([
      waitForPort(API_PORT),
      waitForPort(WEB_PORT),
    ]);

    console.log('Servers ready — creating window');
    await createWindow();
  } catch (err) {
    console.error('Fatal error during startup:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', async () => {
  if (mainWindow === null) await createWindow();
});

app.on('quit', () => {
  killAll();
});

// IPC: first-run wizard complete
ipcMain.handle('mark-first-run-complete', () => {
  markFirstRunComplete();
});
