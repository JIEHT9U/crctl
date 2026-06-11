import { attachSession, detachSession, sessionExists } from "../tmux";
import { sessionName } from "../utils";

export function cmdAttach(): void {
  const cwd = process.cwd();
  const name = sessionName(cwd);

  if (!sessionExists(name)) {
    console.log(`❌ No active session for ${cwd}`);
    console.log("   Run: crctl start");
    process.exit(1);
  }

  const isMac = process.platform === "darwin";
  const easyKey = isMac ? "⌥D  (Option+D)" : "Alt+D";
  console.log(`┌─────────────────────────────────────────────────────┐`);
  console.log(`│  To detach (keep session running):                  │`);
  console.log(`│    ${easyKey.padEnd(49)}│`);
  console.log(`│    or  Ctrl-b  then  d  (tmux default)              │`);
  console.log(`│                                                     │`);
  console.log(`│  To stop completely:  crctl stop                    │`);
  console.log(`└─────────────────────────────────────────────────────┘`);

  const code = attachSession(name);
  if (code !== 0) {
    process.exit(code ?? 1);
  }
}

export function cmdDetach(): void {
  const cwd = process.cwd();
  const name = sessionName(cwd);

  if (!sessionExists(name)) {
    console.log(`❌ No active session for ${cwd}`);
    process.exit(1);
  }

  const code = detachSession(name);
  if (code !== 0) {
    console.log(`⚠️  Could not detach (are you attached to this session?)`);
    process.exit(code ?? 1);
  }
  console.log(`✅ Detached. Session still running. Reconnect with: crctl attach`);
}
