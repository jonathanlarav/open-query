import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import * as net from 'node:net';

const children: ChildProcess[] = [];

export interface SpawnOptions {
  executable: string;
  args: string[];
  env: Record<string, string>;
  /** Working directory for the spawned process. Defaults to the directory containing args[0]. */
  cwd?: string;
}

export function spawnProcess({ executable, args, env, cwd }: SpawnOptions): ChildProcess {
  // Default cwd to the directory of the script being run so that relative
  // paths (like .next/) resolve correctly — especially for the Next.js
  // standalone server which looks for .next/ relative to its own location.
  const workingDir = cwd ?? require('node:path').dirname(args[0]);

  const child = spawn(executable, args, {
    env: { ...process.env, ...env },
    cwd: workingDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (data: Buffer) => {
    console.log(`[child:${child.pid}]`, data.toString().trim());
  });
  child.stderr?.on('data', (data: Buffer) => {
    console.error(`[child:${child.pid}]`, data.toString().trim());
  });
  child.on('exit', (code) => {
    console.log(`[child:${child.pid}] exited with code ${code}`);
  });

  children.push(child);
  return child;
}

export function waitForPort(port: number, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      const socket = new net.Socket();
      socket.setTimeout(500);

      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });

      socket.on('error', () => {
        socket.destroy();
        retry();
      });

      socket.on('timeout', () => {
        socket.destroy();
        retry();
      });

      socket.connect(port, '127.0.0.1');
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for port ${port}`));
        return;
      }
      setTimeout(check, 500);
    };

    check();
  });
}

export function killAll(): void {
  for (const child of children) {
    try {
      child.kill();
    } catch {
      // ignore already-dead processes
    }
  }
  children.length = 0;
}

export function getResourcesPath(): string {
  const isDev = process.env['NODE_ENV'] === 'development';
  if (isDev) {
    return join(__dirname, '../../../../');
  }
  return process.resourcesPath;
}
