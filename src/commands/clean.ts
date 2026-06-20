import { findClaudeProcesses, killPids } from "../processes";
import { loadSessions, saveSessions } from "../registry";
import { killSession, sessionExists } from "../tmux";
import { sessionName, sleep } from "../utils";

export interface CleanOptions {
  /** Clean stale entries across all directories. */
  global?: boolean;
  /** Also tear down a live session before removing its entry. */
  force?: boolean;
}

/**
 * Prune registry entries (`sessions.json`). Unlike `stop`, this manages only
 * the registry — tmux stays the source of truth. A dead session leaves a stale
 * entry that `restore`/autostart would otherwise resurrect; `clean` removes it.
 *
 * Default (current directory): remove the entry only when its session is dead;
 * a live session is left untouched and the user is sent to `crctl stop`.
 * `--force` kills the live session first (mirroring `stop`) and then removes it.
 * `--global` prunes every dead entry at once, skipping live ones unless
 * `--force` is also given.
 */
export function cmdClean(options: CleanOptions = {}): void {
  const data = loadSessions();

  if (options.global) {
    cleanGlobal(data, options.force ?? false);
    return;
  }

  // Current directory only
  const cwd = process.cwd();
  const name = sessionName(cwd);
  const entry = data.sessions[cwd];

  if (!entry) {
    console.log(`ℹ️  No registry entry for ${cwd} — nothing to clean.`);
    return;
  }

  const alive = sessionExists(name);

  if (alive && !options.force) {
    console.log(`⚠️  Session is still running for ${cwd}.`);
    console.log("   Stop it first:    crctl stop");
    console.log("   Or force removal: crctl clean --force");
    return;
  }

  if (alive && options.force) {
    console.log(`🛑 Killing live session for ${cwd}...`);
    killSession(name);
    delete data.sessions[cwd];
    sleep(1000);
    sweepOrphans(data);
    saveSessions(data);
    console.log(`✅ Killed session and removed registry entry for ${cwd}.`);
    return;
  }

  // Dead session — just a stale entry to drop.
  delete data.sessions[cwd];
  saveSessions(data);
  console.log(`🧹 Removed stale registry entry for ${cwd}.`);
}

function cleanGlobal(
  data: ReturnType<typeof loadSessions>,
  force: boolean
): void {
  const entries = Object.values(data.sessions);

  if (entries.length === 0) {
    console.log("ℹ️  Registry is empty — nothing to clean.");
    return;
  }

  const removed: { cwd: string; reason: "dead" | "killed" }[] = [];
  const skipped: string[] = [];
  let killedAny = false;

  for (const s of entries) {
    if (!sessionExists(s.name)) {
      delete data.sessions[s.cwd];
      removed.push({ cwd: s.cwd, reason: "dead" });
    } else if (force) {
      killSession(s.name);
      killedAny = true;
      delete data.sessions[s.cwd];
      removed.push({ cwd: s.cwd, reason: "killed" });
    } else {
      skipped.push(s.cwd);
    }
  }

  // With --force we tore live sessions down; sweep their leftover claude
  // processes once no crctl session remains that could still own them.
  if (killedAny) {
    sleep(1000);
    sweepOrphans(data);
  }

  saveSessions(data);

  if (removed.length === 0) {
    console.log("ℹ️  No stale entries to clean.");
  } else {
    console.log(
      `🧹 Cleaned ${removed.length} ${plural(removed.length, "entry", "entries")} from the registry:`
    );
    for (const r of removed) {
      const tag = r.reason === "killed" ? "killed (--force)" : "dead";
      console.log(`   📂 ${r.cwd}  [${tag}]`);
    }
  }

  if (skipped.length > 0) {
    console.log("");
    console.log(
      `ℹ️  Left ${skipped.length} live ${plural(skipped.length, "session", "sessions")} untouched (use --force to remove):`
    );
    for (const cwd of skipped) console.log(`   📂 ${cwd}`);
  }
}

/**
 * Kill orphaned claude processes, but only when no crctl session in the
 * (already-pruned) registry is still alive to own them — same guard `stop`
 * uses so we never SIGKILL a live session's processes.
 */
function sweepOrphans(data: ReturnType<typeof loadSessions>): void {
  const stillLive = Object.values(data.sessions).some((s) =>
    sessionExists(s.name)
  );
  const pids = stillLive ? [] : findClaudeProcesses();
  if (pids.length > 0) {
    console.log(`   Killing orphaned processes: ${pids.join(" ")}`);
    killPids(pids);
  }
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
