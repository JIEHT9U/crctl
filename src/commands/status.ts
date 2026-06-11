import { findClaudeProcesses } from "../processes";
import { loadSessions } from "../registry";
import { getPanePid, listCrctlSessions, sessionExists } from "../tmux";
import { sessionName } from "../utils";

export function cmdStatus(options: { global?: boolean }): void {
  if (options.global) {
    const data = loadSessions();
    const sessions = Object.values(data.sessions).filter((s) =>
      sessionExists(s.name)
    );

    if (sessions.length === 0) {
      // Fall back to tmux directly in case the registry is empty/stale
      const tmuxSessions = listCrctlSessions();

      if (tmuxSessions.length === 0) {
        console.log("No active crctl sessions");
        return;
      }

      console.log("🌍 Active crctl sessions:");
      console.log("");
      for (const s of tmuxSessions) {
        console.log(`  📂 ${s.path}`);
        console.log(`     Session: ${s.name}`);
        console.log(`     PID: ${getPanePid(s.name)}`);
        console.log("");
      }
      return;
    }

    console.log("🌍 Active crctl sessions:");
    console.log("");
    for (const s of sessions) {
      console.log(`  📂 ${s.cwd}`);
      console.log(`     Session: ${s.name}`);
      console.log(`     PID: ${getPanePid(s.name)}`);
      if (s.link) {
        console.log(`     🔗 ${s.link}`);
      }
      console.log("");
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
    if (entry?.link) {
      console.log(`   🔗 ${entry.link}`);
    }
    console.log(`   PID: ${getPanePid(name)}`);
    return;
  }

  console.log(`❌ Session not running for ${cwd}`);

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
