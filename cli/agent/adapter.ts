// ============================================================
// AI Relay CLI — Agent Adapter Interface
// ============================================================

export interface AgentAdapter {
  id: 'codex' | 'claude' | 'openai-env';
  label: string;
  detect(): Promise<{ installed: boolean; configPath?: string }>;
  install(options: InstallOptions): Promise<InstallResult>;
  doctor(): Promise<DoctorResult>;
  uninstall(): Promise<void>;
}

export interface InstallOptions {
  localRelayUrl: string;
  relayKey: string;
  dryRun?: boolean;
}

export interface InstallResult {
  success: boolean;
  configPath?: string;
  message: string;
}

export interface DoctorResult {
  ok: boolean;
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
  }>;
}
