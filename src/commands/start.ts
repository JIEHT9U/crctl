import { existsSync } from "node:fs";
import { ensureRemoteControlEnabled, trustDirectory } from "../claude";
import {
  DISABLE_TRAFFIC_ENV,
  LINK_WAIT_ATTEMPTS,
  LINK_WAIT_INTERVAL_MS,
} from "../constants";
import { loadSessions, saveSessions } from "../registry";
import { getPaneContent, newSession, sessionExists } from "../tmux";
import type { SessionEntry } from "../types";
import { extractLink, sessionName, sleep } from "../utils";
import { checkUpdateAvailable } from "./update";

export type SpawnMode = "same-dir" | "worktree";

/** Outcome of attempting to (re)start a session for a directory. */
export interface StartResult {
  status: "started" | "already-running" | "failed";
  /** Browser link, when captured. */
  link: string | null;
  /** tmux stderr on failure. */
  stderr?: string;
}

/**
 * Spawn (or detect) a remote-control session for `cwd` and persist it in the
 * registry. Pure orchestration — no console output — so it can be reused by
 * both `crctl start` and `crctl restore` and unit-tested against mocks.
 *
 * `extraArgs` are appended verbatim to the `claude remote-control` invocation
 * (e.g. `--model`, `--dangerously-skip-permissions`) and persisted so that
 * `restore`/autostart bring the session back with the same flags.
 */
export function startSession(
  cwd: string,
  spawnMode: SpawnMode,
  extraArgs: string[] = []
): StartResult {
  const name = sessionName(cwd);

  if (sessionExists(name)) {
    return {
      status: "already-running",
      link: loadSessions().sessions[cwd]?.link ?? null,
    };
  }

  // A moved/deleted project leaves a stale registry entry. tmux's own error
  // for a missing `-c` dir is cryptic (and inconsistent across platforms), so
  // fail early with a clear reason instead of pretending we started something.
  if (!existsSync(cwd)) {
    return { status: "failed", link: null, stderr: "directory no longer exists" };
  }

  // Pre-trust the directory so `claude` doesn't block on the workspace-trust
  // dialog — that prompt would hang invisibly in the detached tmux session and
  // the browser link would never appear.
  trustDirectory(cwd);

  // Strip CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC from the global settings —
  // it disables the feature-flag evaluation Remote Control needs, so claude
  // would otherwise exit immediately. Best-effort and only writes when set.
  ensureRemoteControlEnabled();

  // Remote Control needs feature-flag evaluation, so `claude remote-control`
  // refuses to start when CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC is set.
  // Strip it for just this process via `env -u` — robust no matter where the
  // var lives (the user's shell, or the tmux server's inherited environment).
  const claudeArgs = [
    "env",
    "-u",
    DISABLE_TRAFFIC_ENV,
    "claude",
    "remote-control",
    `--spawn=${spawnMode}`,
    ...extraArgs,
  ];
  const result = newSession(name, cwd, claudeArgs);
  if (result.code !== 0) {
    return { status: "failed", link: null, stderr: result.stderr };
  }

  // Wait for the link to appear (up to 15 seconds), bailing out the instant
  // the session disappears.
  let link: string | null = null;
  for (let i = 0; i < LINK_WAIT_ATTEMPTS; i++) {
    sleep(LINK_WAIT_INTERVAL_MS);
    if (!sessionExists(name)) break;
    link = extractLink(getPaneContent(name));
    if (link) break;
  }

  // `tmux new-session` exits 0 the moment the session is *created*; it does not
  // wait to see whether `claude` survives. If claude exits immediately (crash,
  // auth failure, missing binary) tmux tears the empty session down, so "code
  // 0" is not the same as "running". Verify liveness before claiming success —
  // otherwise `restore` cheerfully reports sessions that are already gone.
  if (!sessionExists(name)) {
    return {
      status: "failed",
      link: null,
      stderr: "session exited immediately — claude failed to start (run `crctl doctor`)",
    };
  }

  const data = loadSessions();
  const entry: SessionEntry = { name, cwd, pids: [], link, spawn: spawnMode };
  // Only record `args` when present — keeps the registry tidy and the common
  // (flag-less) case byte-for-byte identical to before.
  if (extraArgs.length > 0) entry.args = extraArgs;
  data.sessions[cwd] = entry;
  saveSessions(data);

  return { status: "started", link };
}

export function cmdStart(
  claudeArgs: string[] = [],
  options: { spawn?: SpawnMode } = {},
  version: string = "dev"
): void {
  const cwd = process.cwd();
  const spawnMode: SpawnMode = options.spawn ?? "same-dir";

  const newer = checkUpdateAvailable(version);
  if (newer) {
    console.log(
      `⬆️  crctl ${newer} is available (you have ${version}) — run: crctl update`
    );
    console.log("");
  }

  if (sessionExists(sessionName(cwd))) {
    const entry = loadSessions().sessions[cwd];
    console.log(`⚠️  Session already active for ${cwd}`);
    if (entry?.link) {
      console.log(`   🔗 ${entry.link}`);
    }
    console.log(`   Connect via: crctl attach`);
    return;
  }

  console.log(`🚀 Starting Claude Code (remote-control)...`);
  console.log(`   Directory: ${cwd}`);
  console.log(`   Spawn mode: ${spawnMode}`);
  if (claudeArgs.length > 0) {
    console.log(`   Extra flags: ${claudeArgs.join(" ")}`);
  }
  if (ensureRemoteControlEnabled()) {
    console.log(
      `   ⚙️  Removed ${DISABLE_TRAFFIC_ENV} from ~/.claude/settings.json (it blocks Remote Control)`
    );
  }

  const result = startSession(cwd, spawnMode, claudeArgs);
  if (result.status === "failed") {
    console.log(`❌ Failed to start tmux session.`);
    if (result.stderr) {
      console.log(`   ${result.stderr}`);
    }
    console.log(`   Run: crctl doctor`);
    process.exit(1);
  }

  const link = result.link;
  console.log("");
  if (link) {
    console.log("✅ Done!");
    console.log("");
    console.log(`🔗 Browser link:`);
    console.log(`   ${link}`);
    console.log("");
    console.log("📱 Press Space inside the session for a QR code:");
    console.log(`   crctl attach`);
  } else {
    console.log("⚠️  Failed to get the link automatically.");
    console.log("   Connect to the session manually:");
    console.log(`   crctl attach`);
  }
}
