import { findClaudeProcesses } from "../processes";
import { loadSessions } from "../registry";
import { getPanePid, listCrctlSessions, sessionExists } from "../tmux";
import type { SessionEntry } from "../types";
import { sessionName } from "../utils";

/** Print the spawn mode and any saved extra flags for a registered session. */
function logParams(entry: SessionEntry, indent: string): void {
  console.log(`${indent}Spawn: ${entry.spawn ?? "same-dir"}`);
  if (entry.args && entry.args.length > 0) {
    console.log(`${indent}Args: ${entry.args.join(" ")}`);
  }
}

export function cmdStatus(options: { global?: boolean }): void {
  if (options.global) {
    const data = loadSessions();
    const all = Object.values(data.sessions);
    const live = all.filter((s) => sessionExists(s.name));
    const stale = all.filter((s) => !sessionExists(s.name));

    if (live.length > 0) {
      console.log("🌍 Active crctl sessions:");
      console.log("");
      for (const s of live) {
        console.log(`  📂 ${s.cwd}`);
        console.log(`     Session: ${s.name}`);
        console.log(`     PID: ${getPanePid(s.name)}`);
        logParams(s, "     ");
        if (s.link) {
          console.log(`     🔗 ${s.link}`);
        }
        console.log("");
      }
    } else {
      // Registry knows of no live session — ask tmux directly in case the
      // registry is empty or stale and a session is running unrecorded.
      const tmuxSessions = listCrctlSessions();
      if (tmuxSessions.length > 0) {
        console.log("🌍 Active crctl sessions:");
        console.log("");
        for (const s of tmuxSessions) {
          console.log(`  📂 ${s.path}`);
          console.log(`     Session: ${s.name}`);
          console.log(`     PID: ${getPanePid(s.name)}`);
          console.log("");
        }
      } else if (stale.length === 0) {
        console.log("No active crctl sessions");
        return;
      }
    }

    if (stale.length > 0) {
      console.log("🧟 Stale entries (session dead — run: crctl clean -g):");
      console.log("");
      for (const s of stale) {
        console.log(`  📂 ${s.cwd}`);
        console.log(`     Session: ${s.name}`);
        logParams(s, "     ");
        console.log("");
      }
    }
    return;
  }

  // Normal mode — current directory
  const cwd = process.cwd();
  const name = sessionName(cwd);

  const active = sessionExists(name);
  const data = loadSessions();
  const entry = data.sessions[cwd];

  if (active) {
    console.log(`✅ Session active for ${cwd}`);
    console.log(`   Session: ${name}`);
    if (entry) {
      logParams(entry, "   ");
    }
    if (entry?.link) {
      console.log(`   🔗 ${entry.link}`);
    }
    console.log(`   PID: ${getPanePid(name)}`);
    return;
  }

  console.log(`❌ Session not running for ${cwd}`);

  // A registry entry for a dead session is stale; show how it was last
  // started so the user knows what `restore`/`start` would bring back.
  if (entry) {
    console.log(`   Stale registry entry (was last started with):`);
    logParams(entry, "     ");
    if (entry.link) {
      console.log(`     🔗 ${entry.link}`);
    }
    console.log(`   Remove it with: crctl clean`);
  }

  // Warn about orphans only when they cannot belong to another live session
  const othersActive = Object.values(data.sessions).some(
    (s) => s.cwd !== cwd && sessionExists(s.name)
  );
  const pids = othersActive ? [] : findClaudeProcesses();
  if (pids.length > 0) {
    console.log(`⚠️  But there are orphaned processes: ${pids.join(" ")}`);
    console.log("   Run: crctl stop");
  }
}
