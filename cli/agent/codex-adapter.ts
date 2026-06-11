// ============================================================
// AI Relay CLI — Codex Agent Adapter
// ============================================================

import type { AgentAdapter, InstallOptions, InstallResult, DoctorResult } from './adapter';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class CodexAdapter implements AgentAdapter {
  id = 'codex' as const;
  label = 'Codex';

  async detect(): Promise<{ installed: boolean; configPath?: string }> {
    const configPath = path.join(os.homedir(), '.codex', 'config.toml');
    return {
      installed: fs.existsSync(configPath),
      configPath: fs.existsSync(configPath) ? configPath : undefined,
    };
  }

  async install(options: InstallOptions): Promise<InstallResult> {
    const configPath = path.join(os.homedir(), '.codex', 'config.toml');

    if (!fs.existsSync(configPath)) {
      return {
        success: false,
        message: 'Codex config not found. Install Codex first.',
      };
    }

    const snippet = `
[model_providers.ai-relay-local]
name = "AI Relay Local"
base_url = "${options.localRelayUrl}/v1"
wire_api = "chat"
requires_openai_auth = true
`;

    if (options.dryRun) {
      return {
        success: true,
        configPath,
        message: `Would append to ${configPath}:\n${snippet}`,
      };
    }

    fs.appendFileSync(configPath, snippet);

    return {
      success: true,
      configPath,
      message: `Added ai-relay-local provider to ${configPath}`,
    };
  }

  async doctor(): Promise<DoctorResult> {
    const detection = await this.detect();
    return {
      ok: detection.installed,
      checks: [
        {
          name: 'Codex installed',
          status: detection.installed ? 'pass' : 'fail',
          message: detection.installed ? 'Found config at ~/.codex/config.toml' : 'Codex config not found',
        },
      ],
    };
  }

  async uninstall(): Promise<void> {
    // TODO: Remove ai-relay-local provider from config
  }
}
