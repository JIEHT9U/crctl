import { latestSessionId } from "../claude";
import { loadSessions } from "../registry";
import { sessionExists } from "../tmux";
import { startSession } from "./start";

/**
 * Re-spawn every session recorded in the registry that is not already running.
 * Invoked by the autostart service on login, but also runnable by hand.
 *
 * A reboot kills the live Remote Control process and ends its session, so the
 * chat you had open goes dead. To bring it back rather than start an empty
 * one, restore resumes each project's most recent conversation via
 * `claude --resume <id> --remote-control`. When a project has no transcript
 * yet, it falls back to a fresh session.
 */
export function cmdRestore(): void {
  const entries = Object.values(loadSessions().sessions);

  if (entries.length === 0) {
    console.log("ℹ️  No sessions to restore.");
    return;
  }

  console.log(`🔄 Restoring ${entries.length} session(s)...`);

  let started = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of entries) {
    if (sessionExists(entry.name)) {
      skipped++;
      console.log(`   ⏭️  ${entry.cwd} (already running)`);
      continue;
    }

    const resume = latestSessionId(entry.cwd);
    const result = startSession(
      entry.cwd,
      entry.spawn ?? "same-dir",
      entry.args ?? [],
      { resume }
    );
    if (result.status === "started") {
      started++;
      console.log(`   ✅ ${entry.cwd}${resume ? " (resumed last chat)" : " (fresh)"}`);
    } else if (result.status === "already-running") {
      skipped++;
      console.log(`   ⏭️  ${entry.cwd} (already running)`);
    } else {
      failed++;
      const reason = result.stderr ? ` — ${result.stderr}` : "";
      console.log(`   ❌ ${entry.cwd}${reason}`);
    }
  }

  console.log("");
  console.log(`Done: ${started} started, ${skipped} skipped, ${failed} failed.`);
}
