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

import { cmdStart } from "../../src/commands/start";
import { loadSessions, saveSessions } from "../../src/registry";
import { getPaneContent, newSession, sessionExists } from "../../src/tmux";
import { sessionName } from "../../src/utils";
import { captureLog, mockCwd, trapExit } from "../helpers";

const CWD = "/home/user/project";
const NAME = sessionName(CWD);
const LINK = "https://claude.ai/code?environment=abc123";

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  mockCwd(CWD);
  vi.mocked(loadSessions).mockReturnValue({ sessions: {} });
  vi.mocked(newSession).mockReturnValue({ stdout: "", stderr: "", code: 0 });
  vi.mocked(getPaneContent).mockReturnValue("");
});

describe("cmdStart", () => {
  it("does not start a second session when one is already active", () => {
    vi.mocked(sessionExists).mockReturnValue(true);
    vi.mocked(loadSessions).mockReturnValue({
      sessions: { [CWD]: { name: NAME, cwd: CWD, pids: [], link: LINK } },
    });
    const log = captureLog();

    cmdStart();

    expect(newSession).not.toHaveBeenCalled();
    expect(log.output()).toContain("Session already active");
    expect(log.output()).toContain("crctl attach");
    expect(log.output()).toContain(LINK);
  });

  it("passes --spawn=same-dir to claude by default", () => {
    vi.mocked(sessionExists).mockReturnValue(false);
    vi.mocked(getPaneContent).mockReturnValue(LINK);
    captureLog();

    cmdStart();

    expect(newSession).toHaveBeenCalledWith(NAME, CWD, [
      "claude", "remote-control", "--spawn=same-dir",
    ]);
  });

  it("passes --spawn=worktree when requested", () => {
    vi.mocked(sessionExists).mockReturnValue(false);
    vi.mocked(getPaneContent).mockReturnValue(LINK);
    captureLog();

    cmdStart({ spawn: "worktree" });

    expect(newSession).toHaveBeenCalledWith(NAME, CWD, [
      "claude", "remote-control", "--spawn=worktree",
    ]);
  });

  it("saves spawn mode to the registry", () => {
    vi.mocked(sessionExists).mockReturnValue(false);
    vi.mocked(getPaneContent).mockReturnValue(LINK);
    captureLog();

    cmdStart({ spawn: "worktree" });

    expect(saveSessions).toHaveBeenCalledWith({
      sessions: {
        [CWD]: { name: NAME, cwd: CWD, pids: [], link: LINK, spawn: "worktree" },
      },
    });
  });

  it("starts a session and saves the captured link to the registry", () => {
    vi.mocked(sessionExists).mockReturnValue(false);
    vi.mocked(getPaneContent).mockReturnValue(`some output\n${LINK}\nmore`);
    const log = captureLog();

    cmdStart();

    expect(saveSessions).toHaveBeenCalledWith({
      sessions: {
        [CWD]: { name: NAME, cwd: CWD, pids: [], link: LINK, spawn: "same-dir" },
      },
    });
    expect(log.output()).toContain(LINK);
    expect(log.output()).toContain("✅ Done!");
  });

  it("exits with an error when tmux fails to start", () => {
    vi.mocked(sessionExists).mockReturnValue(false);
    vi.mocked(newSession).mockReturnValue({
      stdout: "",
      stderr: "tmux: command not found",
      code: 127,
    });
    const log = captureLog();
    trapExit();

    expect(() => cmdStart()).toThrow("process.exit(1)");
    expect(log.output()).toContain("Failed to start tmux session");
    expect(log.output()).toContain("crctl doctor");
    expect(saveSessions).not.toHaveBeenCalled();
  });

  it("still registers the session when the link never appears", () => {
    vi.mocked(sessionExists).mockReturnValue(false);
    vi.mocked(getPaneContent).mockReturnValue("starting up...");
    captureLog();

    cmdStart();

    expect(saveSessions).toHaveBeenCalledWith({
      sessions: {
        [CWD]: { name: NAME, cwd: CWD, pids: [], link: null, spawn: "same-dir" },
      },
    });
  });

  it("stops polling as soon as the link appears", () => {
    vi.mocked(sessionExists).mockReturnValue(false);
    vi.mocked(getPaneContent)
      .mockReturnValueOnce("booting")
      .mockReturnValueOnce(LINK);
    captureLog();

    cmdStart();

    expect(getPaneContent).toHaveBeenCalledTimes(2);
  });
});
