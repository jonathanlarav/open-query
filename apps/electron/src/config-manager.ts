import { app } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

interface AppConfig {
  masterKey: string;
  firstRunComplete: boolean;
}

function getConfigPath(): string {
  return join(app.getPath('userData'), 'config.json');
}

function readConfig(): AppConfig | null {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8')) as AppConfig;
  } catch {
    return null;
  }
}

function writeConfig(config: AppConfig): void {
  const configPath = getConfigPath();
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function getOrCreateConfig(): AppConfig {
  const existing = readConfig();
  if (existing) return existing;

  const config: AppConfig = {
    masterKey: randomBytes(32).toString('hex'),
    firstRunComplete: false,
  };
  writeConfig(config);
  return config;
}

export function markFirstRunComplete(): void {
  const config = readConfig();
  if (!config) return;
  writeConfig({ ...config, firstRunComplete: true });
}
