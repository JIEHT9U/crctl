import { beforeEach, describe, expect, it, vi } from "vitest";

// restore is pure orchestration over startSession: mock that boundary and
// assert how restore drives it (spawn mode, persisted flags, started/skipped/
// failed counting). startSession's own behaviour is covered in start.test.ts.
vi.mock("../../src/commands/start", () => ({ startSession: vi.fn() }));
vi.mock("../../src/registry", () => ({ loadSessions: vi.fn(), saveSessions: vi.fn() }));
vi.mock("../../src/tmux", () => ({ sessionExists: vi.fn() }));
vi.mock("../../src/claude", () => ({ latestSessionId: vi.fn() }));

import { latestSessionId } from "../../src/claude";
import { cmdRestore } from "../../src/commands/restore";
import { startSession } from "../../src/commands/start";
import { loadSessions } from "../../src/registry";
import { sessionExists } from "../../src/tmux";
import { captureLog } from "../helpers";

const A = "/home/user/project-a";
const B = "/home/user/project-b";
const entry = (
  cwd: string,
  spawn?: "same-dir" | "worktree",
  args?: string[]
) => ({
  name: `claude-rc-${cwd.length}`, // unique-enough fake name per cwd
  cwd,
  pids: [],
  link: null,
  spawn,
  args,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.mocked(sessionExists).mockReturnValue(false);
  vi.mocked(startSession).mockReturnValue({ status: "started", link: null });
  // Default: no prior transcript, so restore falls back to a fresh session.
  vi.mocked(latestSessionId).mockReturnValue(null);
});

describe("cmdRestore", () => {
  it("reports when there is nothing to restore", () => {
    vi.mocked(loadSessions).mockReturnValue({ sessions: {} });
    const log = captureLog();

    cmdRestore();

    expect(log.output()).toContain("No sessions to restore");
    expect(startSession).not.toHaveBeenCalled();
  });

  it("re-spawns sessions that are not currently running", () => {
    vi.mocked(loadSessions).mockReturnValue({
      sessions: { [A]: entry(A, "worktree") },
    });
    const log = captureLog();

    cmdRestore();

    expect(startSession).toHaveBeenCalledWith(A, "worktree", [], { resume: null });
    expect(log.output()).toContain("1 started");
  });

  it("resumes the project's most recent conversation when one exists", () => {
    vi.mocked(loadSessions).mockReturnValue({ sessions: { [A]: entry(A) } });
    vi.mocked(latestSessionId).mockReturnValue("sid-123");
    const log = captureLog();

    cmdRestore();

    expect(latestSessionId).toHaveBeenCalledWith(A);
    expect(startSession).toHaveBeenCalledWith(A, "same-dir", [], { resume: "sid-123" });
    expect(log.output()).toContain("resumed last chat");
  });

  it("falls back to a fresh session when the project has no transcript", () => {
    vi.mocked(loadSessions).mockReturnValue({ sessions: { [A]: entry(A) } });
    vi.mocked(latestSessionId).mockReturnValue(null);
    const log = captureLog();

    cmdRestore();

    expect(startSession).toHaveBeenCalledWith(A, "same-dir", [], { resume: null });
    expect(log.output()).toContain("(fresh)");
  });

  it("defaults to same-dir when no spawn mode was recorded", () => {
    vi.mocked(loadSessions).mockReturnValue({ sessions: { [A]: entry(A) } });
    captureLog();

    cmdRestore();

    expect(startSession).toHaveBeenCalledWith(A, "same-dir", [], { resume: null });
  });

  it("re-applies persisted extra flags when restoring", () => {
    vi.mocked(loadSessions).mockReturnValue({
      sessions: { [A]: entry(A, "same-dir", ["--model", "opus"]) },
    });
    captureLog();

    cmdRestore();

    expect(startSession).toHaveBeenCalledWith(A, "same-dir", ["--model", "opus"], {
      resume: null,
    });
  });

  it("skips sessions that are already running", () => {
    vi.mocked(loadSessions).mockReturnValue({ sessions: { [A]: entry(A) } });
    vi.mocked(sessionExists).mockReturnValue(true);
    const log = captureLog();

    cmdRestore();

    expect(startSession).not.toHaveBeenCalled();
    expect(log.output()).toContain("already running");
    expect(log.output()).toContain("1 skipped");
  });

  it("counts failures (with their reason) without aborting the rest", () => {
    vi.mocked(loadSessions).mockReturnValue({
      sessions: { [A]: entry(A), [B]: entry(B) },
    });
    vi.mocked(startSession)
      .mockReturnValueOnce({
        status: "failed",
        link: null,
        stderr: "directory no longer exists",
      })
      .mockReturnValueOnce({ status: "started", link: null });
    const log = captureLog();

    cmdRestore();

    expect(startSession).toHaveBeenCalledTimes(2);
    expect(log.output()).toContain("1 started");
    expect(log.output()).toContain("1 failed");
    expect(log.output()).toContain("directory no longer exists");
  });
});
