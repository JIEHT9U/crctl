import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/tmux", () => ({
  sessionExists: vi.fn(),
  newSession: vi.fn(),
  getPaneContent: vi.fn(),
}));
vi.mock("../../src/registry", () => ({
  loadSessions: vi.fn(),
  saveSessions: vi.fn(),
}));
vi.mock("../../src/claude", () => ({ trustDirectory: vi.fn() }));
vi.mock("../../src/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/utils")>()),
  sleep: vi.fn(),
}));

import { cmdRestore } from "../../src/commands/restore";
import { loadSessions, saveSessions } from "../../src/registry";
import { getPaneContent, newSession, sessionExists } from "../../src/tmux";
import { captureLog } from "../helpers";

const A = "/home/user/project-a";
const B = "/home/user/project-b";
const entry = (cwd: string, spawn?: "same-dir" | "worktree") => ({
  name: `claude-rc-${cwd.length}`, // unique-enough fake name per cwd
  cwd,
  pids: [],
  link: null,
  spawn,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.mocked(newSession).mockReturnValue({ stdout: "", stderr: "", code: 0 });
  vi.mocked(getPaneContent).mockReturnValue("");
});

describe("cmdRestore", () => {
  it("reports when there is nothing to restore", () => {
    vi.mocked(loadSessions).mockReturnValue({ sessions: {} });
    const log = captureLog();

    cmdRestore();

    expect(log.output()).toContain("No sessions to restore");
    expect(newSession).not.toHaveBeenCalled();
  });

  it("re-spawns sessions that are not currently running", () => {
    vi.mocked(loadSessions).mockReturnValue({
      sessions: { [A]: entry(A, "worktree") },
    });
    vi.mocked(sessionExists).mockReturnValue(false);
    const log = captureLog();

    cmdRestore();

    expect(newSession).toHaveBeenCalledWith(expect.any(String), A, [
      "claude", "remote-control", "--spawn=worktree",
    ]);
    expect(saveSessions).toHaveBeenCalled();
    expect(log.output()).toContain("1 started");
  });

  it("defaults to same-dir when no spawn mode was recorded", () => {
    vi.mocked(loadSessions).mockReturnValue({ sessions: { [A]: entry(A) } });
    vi.mocked(sessionExists).mockReturnValue(false);
    captureLog();

    cmdRestore();

    expect(newSession).toHaveBeenCalledWith(expect.any(String), A, [
      "claude", "remote-control", "--spawn=same-dir",
    ]);
  });

  it("skips sessions that are already running", () => {
    vi.mocked(loadSessions).mockReturnValue({ sessions: { [A]: entry(A) } });
    vi.mocked(sessionExists).mockReturnValue(true);
    const log = captureLog();

    cmdRestore();

    expect(newSession).not.toHaveBeenCalled();
    expect(log.output()).toContain("already running");
    expect(log.output()).toContain("1 skipped");
  });

  it("counts failures without aborting the rest", () => {
    vi.mocked(loadSessions).mockReturnValue({
      sessions: { [A]: entry(A), [B]: entry(B) },
    });
    vi.mocked(sessionExists).mockReturnValue(false);
    vi.mocked(newSession)
      .mockReturnValueOnce({ stdout: "", stderr: "no such dir", code: 1 })
      .mockReturnValueOnce({ stdout: "", stderr: "", code: 0 });
    const log = captureLog();

    cmdRestore();

    expect(newSession).toHaveBeenCalledTimes(2);
    expect(log.output()).toContain("1 started");
    expect(log.output()).toContain("1 failed");
    expect(log.output()).toContain("no such dir");
  });
});
