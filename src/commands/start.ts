import { LINK_WAIT_ATTEMPTS, LINK_WAIT_INTERVAL_MS } from "../constants";
import { loadSessions, saveSessions } from "../registry";
import { getPaneContent, newSession, sessionExists } from "../tmux";
import { extractLink, sessionName, sleep } from "../utils";

export type SpawnMode = "same-dir" | "worktree";

export function cmdStart(options: { spawn?: SpawnMode } = {}): void {
  const cwd = process.cwd();
  const name = sessionName(cwd);

  if (sessionExists(name)) {
    const entry = loadSessions().sessions[cwd];
    console.log(`⚠️  Session already active for ${cwd}`);
    if (entry?.link) {
      console.log(`   🔗 ${entry.link}`);
    }
    console.log(`   Connect via: crctl attach`);
    return;
  }

  const spawnMode: SpawnMode = options.spawn ?? "same-dir";
  const claudeArgs = ["claude", "remote-control", `--spawn=${spawnMode}`];

  console.log(`🚀 Starting Claude Code (remote-control)...`);
  console.log(`   Directory: ${cwd}`);
  console.log(`   Spawn mode: ${spawnMode}`);

  const result = newSession(name, cwd, claudeArgs);
  if (result.code !== 0) {
    console.log(`❌ Failed to start tmux session.`);
    if (result.stderr) {
      console.log(`   ${result.stderr}`);
    }
    console.log(`   Run: crctl doctor`);
    process.exit(1);
  }

  // Wait for the link to appear (up to 15 seconds)
  let link: string | null = null;
  for (let i = 0; i < LINK_WAIT_ATTEMPTS; i++) {
    sleep(LINK_WAIT_INTERVAL_MS);
    link = extractLink(getPaneContent(name));
    if (link) break;
  }

  const data = loadSessions();
  data.sessions[cwd] = { name, cwd, pids: [], link, spawn: spawnMode };
  saveSessions(data);

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
