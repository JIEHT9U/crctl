import { findClaudeProcesses, killPids } from "../processes";
import { loadSessions, saveSessions } from "../registry";
import { killSession, sessionExists } from "../tmux";
import { sessionName, sleep } from "../utils";

export function cmdStop(options: { global?: boolean }): void {
  const data = loadSessions();

  if (options.global) {
    const targets = Object.values(data.sessions).filter((s) =>
      sessionExists(s.name)
    );

    if (targets.length === 0) {
      console.log("ℹ️  No active sessions.");
      return;
    }

    console.log(`🛑 Stopping all sessions (${targets.length})...`);
    for (const s of targets) {
      console.log(`   📂 ${s.cwd}`);
      killSession(s.name);
      delete data.sessions[s.cwd];
    }

    sleep(1000);
    const pids = findClaudeProcesses();
    if (pids.length > 0) {
      console.log(`   Killing orphaned processes: ${pids.join(" ")}`);
      killPids(pids);
    }

    saveSessions(data);
    console.log("✅ All sessions stopped.");
    return;
  }

  // Current directory only
  const cwd = process.cwd();
  const name = sessionName(cwd);
  let stopped = false;

  if (sessionExists(name)) {
    console.log(`🛑 Stopping session for ${cwd}...`);
    killSession(name);
    stopped = true;
    delete data.sessions[cwd];

    sleep(1000);
  }

  // Only sweep orphaned claude processes when no OTHER crctl session is
  // active — otherwise we would kill processes belonging to live sessions
  // in other directories.
  const othersActive = Object.values(data.sessions).some(
    (s) => s.cwd !== cwd && sessionExists(s.name)
  );
  const pids = othersActive ? [] : findClaudeProcesses();
  if (pids.length > 0) {
    console.log(`   Killing orphaned processes: ${pids.join(" ")}`);
    killPids(pids);
  }

  saveSessions(data);

  if (stopped) {
    console.log("✅ Session and all processes terminated.");
  } else if (pids.length > 0) {
    console.log("✅ Processes terminated.");
  } else {
    console.log("ℹ️  Session not found. All clean.");
  }
}
