import { join } from "node:path";
import { homedir } from "node:os";

/** Prefix for all tmux sessions managed by crctl. */
export const SESSION_PREFIX = "claude-rc";

/** Per-user config directory (platform-dependent). */
export const CONFIG_DIR =
  process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support", "crctl")
    : join(homedir(), ".config", "crctl");

/** Session registry file. */
export const SESSIONS_FILE = join(CONFIG_DIR, "sessions.json");

/**
 * Claude Code's global config (`~/.claude.json`). crctl reads/writes the
 * per-project `hasTrustDialogAccepted` flag here so a detached `claude
 * remote-control` doesn't block on the workspace-trust dialog.
 */
export const CLAUDE_CONFIG_FILE = join(homedir(), ".claude.json");

/**
 * Claude Code's settings file (`~/.claude/settings.json`). crctl strips the
 * `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` kill-switch from its `env` block
 * on start — that flag disables the feature-flag evaluation Remote Control
 * needs, so `claude remote-control` refuses to start while it's set.
 */
export const CLAUDE_SETTINGS_FILE = join(homedir(), ".claude", "settings.json");

/**
 * Claude Code's per-project conversation store (`~/.claude/projects`). Each
 * project gets a subdirectory (its absolute path with `/` and `.` turned into
 * `-`) holding one `<session-id>.jsonl` transcript per conversation. crctl
 * reads this to find the chat you were last working in so `restore` can resume
 * it after a reboot instead of spawning an empty one.
 */
export const CLAUDE_PROJECTS_DIR = join(homedir(), ".claude", "projects");

/** GitHub repository (owner/name) used by `crctl update`. */
export const REPO = "JIEHT9U/crctl";

/** systemd user unit file (Linux) — restores sessions after login. */
export const SYSTEMD_UNIT_NAME = "crctl.service";
export const SYSTEMD_UNIT_PATH = join(
  homedir(),
  ".config",
  "systemd",
  "user",
  SYSTEMD_UNIT_NAME
);

/** launchd LaunchAgent (macOS) — restores sessions after login. */
export const LAUNCHD_LABEL = "com.crctl.restore";
export const LAUNCHD_PLIST_PATH = join(
  homedir(),
  "Library",
  "LaunchAgents",
  `${LAUNCHD_LABEL}.plist`
);

/**
 * Env var that disables claude's "nonessential" traffic. Remote Control needs
 * feature-flag evaluation (a network call), so `claude remote-control` refuses
 * to start when this is set. crctl strips it from the spawned claude process.
 */
export const DISABLE_TRAFFIC_ENV = "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC";

/** How many times to poll the pane for the browser link. */
export const LINK_WAIT_ATTEMPTS = 30;

/** Delay between polls, in milliseconds (30 × 500ms = 15s total). */
export const LINK_WAIT_INTERVAL_MS = 500;
