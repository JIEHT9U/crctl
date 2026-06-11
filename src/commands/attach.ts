import { attachSession, sessionExists } from "../tmux";
import { sessionName } from "../utils";

export function cmdAttach(): void {
  const cwd = process.cwd();
  const name = sessionName(cwd);

  if (!sessionExists(name)) {
    console.log(`❌ No active session for ${cwd}`);
    console.log("   Run: crctl start");
    process.exit(1);
  }

  const code = attachSession(name);
  if (code !== 0) {
    process.exit(code ?? 1);
  }
}
