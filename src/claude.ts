import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  CLAUDE_CONFIG_FILE,
  CLAUDE_SETTINGS_FILE,
  DISABLE_TRAFFIC_ENV,
} from "./constants";

// ─── Claude Code config integration ──────────────────────────
//
// When `claude remote-control` starts in a directory it has never seen, it
// shows the "Do you trust the files in this folder?" dialog. crctl launches
// claude *detached* inside tmux, so that prompt hangs invisibly and the
// browser link never appears. To avoid this we pre-mark the directory as
// trusted in Claude's own config (`~/.claude.json`), keyed by absolute path.

/** Shape of a fresh project entry, mirroring Claude's own defaults. */
const DEFAULT_PROJECT_ENTRY = {
  allowedTools: [] as string[],
  mcpContextUris: [] as string[],
  mcpServers: {},
  enabledMcpjsonServers: [] as string[],
  disabledMcpjsonServers: [] as string[],
  hasTrustDialogAccepted: true,
  projectOnboardingSeenCount: 0,
  hasClaudeMdExternalIncludesApproved: false,
  hasClaudeMdExternalIncludesWarningShown: false,
};

/** Whether `cwd` is already marked trusted in the given config object. */
export function isDirectoryTrusted(config: unknown, cwd: string): boolean {
  const projects = (config as { projects?: Record<string, unknown> })?.projects;
  const entry = projects?.[cwd] as { hasTrustDialogAccepted?: boolean };
  return entry?.hasTrustDialogAccepted === true;
}

/**
 * Pure: return a copy of `config` with `cwd` marked as a trusted workspace.
 * Existing project entries keep all their other fields; unknown/empty configs
 * get a sensible default scaffold. Other projects are never touched.
 */
export function withTrustedDirectory(
  config: unknown,
  cwd: string
): Record<string, unknown> {
  const base =
    config && typeof config === "object" ? (config as Record<string, unknown>) : {};
  const projects =
    base.projects && typeof base.projects === "object"
      ? (base.projects as Record<string, Record<string, unknown>>)
      : {};
  const existing = projects[cwd];

  return {
    ...base,
    projects: {
      ...projects,
      [cwd]: existing
        ? { ...existing, hasTrustDialogAccepted: true }
        : { ...DEFAULT_PROJECT_ENTRY },
    },
  };
}

/**
 * Mark `cwd` as a trusted workspace in Claude's config so a detached
 * `claude remote-control` won't block on the trust dialog.
 *
 * Best-effort: never throws (a failure here must not abort `crctl start`) and
 * skips the write entirely when the directory is already trusted — keeping the
 * read-modify-write window small to avoid clobbering a concurrently-running
 * Claude instance. Returns whether `cwd` ends up trusted.
 */
export function trustDirectory(
  cwd: string,
  file: string = CLAUDE_CONFIG_FILE
): boolean {
  try {
    let config: unknown = {};
    if (existsSync(file)) {
      config = JSON.parse(readFileSync(file, "utf8"));
      if (isDirectoryTrusted(config, cwd)) return true; // nothing to do
    }
    writeFileSync(file, JSON.stringify(withTrustedDirectory(config, cwd), null, 2));
    return true;
  } catch {
    return false;
  }
}

// ─── Remote Control traffic flag ─────────────────────────────
//
// `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` (set in the `env` block of
// `~/.claude/settings.json`) disables the feature-flag evaluation that Remote
// Control requires, so `claude remote-control` exits immediately while it's
// set. crctl strips it from the *global* settings on start so a session can
// actually come up. (Keep it in a project's `.claude/settings.json` if you
// want that repo to stay quiet — crctl only touches the global file.)

/** Whether `config.env` defines the nonessential-traffic kill-switch. */
export function hasTrafficFlag(config: unknown): boolean {
  const env = (config as { env?: Record<string, unknown> })?.env;
  return !!env && typeof env === "object" && DISABLE_TRAFFIC_ENV in env;
}

/**
 * Pure: return a copy of `config` with the traffic kill-switch removed from its
 * `env` block. Everything else (other env vars, all other keys) is untouched.
 */
export function withoutTrafficFlag(config: unknown): Record<string, unknown> {
  const base =
    config && typeof config === "object" ? (config as Record<string, unknown>) : {};
  if (!hasTrafficFlag(base)) return base;
  const { [DISABLE_TRAFFIC_ENV]: _removed, ...env } = base.env as Record<
    string,
    unknown
  >;
  return { ...base, env };
}

/**
 * Remove `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` from claude's global
 * settings so `claude remote-control` can start.
 *
 * Best-effort: never throws (a failure here must not abort `crctl start`) and
 * only writes when the flag is actually present, so a normal start touches
 * nothing. Returns whether the file was patched.
 */
export function ensureRemoteControlEnabled(
  file: string = CLAUDE_SETTINGS_FILE
): boolean {
  try {
    if (!existsSync(file)) return false;
    const config: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!hasTrafficFlag(config)) return false;
    writeFileSync(file, JSON.stringify(withoutTrafficFlag(config), null, 2));
    return true;
  } catch {
    return false;
  }
}
