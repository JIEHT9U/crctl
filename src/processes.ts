import { execSync } from "node:child_process";

/**
 * Parse `ps aux` output and return PIDs of claude remote-control processes,
 * excluding our own.
 */
export function parseClaudePids(psOutput: string, excludePid: number): number[] {
  const pids: number[] = [];
  for (const line of psOutput.split("\n")) {
    if (line.includes("claude") && line.includes("remote-control")) {
      const pid = parseInt(line.trim().split(/\s+/)[1], 10);
      if (!isNaN(pid) && pid !== excludePid) {
        pids.push(pid);
      }
    }
  }
  return pids;
}

/** Find running claude remote-control processes system-wide. */
export function findClaudeProcesses(): number[] {
  try {
    const output = execSync("ps aux", { encoding: "utf8" });
    return parseClaudePids(output, process.pid);
  } catch {
    return [];
  }
}

/** Force-kill the given PIDs, ignoring already-gone processes. */
export function killPids(pids: number[]): void {
  for (const pid of pids) {
    try {
      process.kill(pid, 9);
    } catch {
      // Process already gone
    }
  }
}
