// ============================================================
// AI Relay CLI — Local Profile Management
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface LocalProfile {
  cloudUrl: string;
  deviceId: string;
  deviceToken: string;
  listenHost: string;
  listenPort: number;
  configVersion: number;
  lastSyncAt: string;
}

export function getProfileDir(): string {
  return path.join(os.homedir(), '.ai-relay');
}

export function getProfilePath(): string {
  return path.join(getProfileDir(), 'config.json');
}

export function getDbPath(): string {
  return path.join(getProfileDir(), 'local.db');
}

export async function loadProfile(): Promise<LocalProfile | null> {
  const profilePath = getProfilePath();
  if (!fs.existsSync(profilePath)) {
    return null;
  }
  const data = fs.readFileSync(profilePath, 'utf-8');
  return JSON.parse(data);
}

export async function saveProfile(profile: LocalProfile): Promise<void> {
  const profileDir = getProfileDir();
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }
  const profilePath = getProfilePath();
  fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf-8');
}

export function ensureDirectories(): void {
  const profileDir = getProfileDir();
  const logsDir = path.join(profileDir, 'logs');
  const backupsDir = path.join(profileDir, 'backups');
  const agentsDir = path.join(profileDir, 'agents');

  for (const dir of [profileDir, logsDir, backupsDir, agentsDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
