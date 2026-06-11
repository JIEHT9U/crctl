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

/** GitHub repository (owner/name) used by `crctl update`. */
export const REPO = "JIEHT9U/crctl";

/** How many times to poll the pane for the browser link. */
export const LINK_WAIT_ATTEMPTS = 30;

/** Delay between polls, in milliseconds (30 × 500ms = 15s total). */
export const LINK_WAIT_INTERVAL_MS = 500;
