import { loadSessions, saveSessions } from "../registry";
import { getPaneContent, sessionExists } from "../tmux";
import { extractLink, sessionName } from "../utils";

export function cmdLink(): void {
  const cwd = process.cwd();
  const name = sessionName(cwd);

  // First look in the registry
  const data = loadSessions();
  const entry = data.sessions[cwd];
  if (entry?.link) {
    console.log(entry.link);
    return;
  }

  // If not in registry — look in the live tmux pane
  if (sessionExists(name)) {
    const link = extractLink(getPaneContent(name));
    if (link) {
      console.log(link);
      data.sessions[cwd] = entry
        ? { ...entry, link }
        : { name, cwd, pids: [], link };
      saveSessions(data);
      return;
    }
  }

  console.log("❌ Link not found");
  process.exit(1);
}
