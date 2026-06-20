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
vi.mock("../../src/claude", () => ({
  trustDirectory: vi.fn(),
  ensureRemoteControlEnabled: vi.fn(),
}));
vi.mock("../../src/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/utils")>()),
  sleep: vi.fn(),
}));
// start.ts only needs existsSync from node:fs; mock it directly. (Spreading
// importOriginal() does not reliably override named exports of Node built-ins.)
vi.mock("node:fs", () => ({ existsSync: vi.fn() }));
vi.mock("../../src/commands/update", () => ({ checkUpdateAvailable: vi.fn() }));

import { existsSync } from "node:fs";
import { ensureRemoteControlEnabled } from "../../src/claude";
import { cmdStart, startSession } from "../../src/commands/start";
import { checkUpdateAvailable } from "../../src/commands/update";
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
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(checkUpdateAvailable).mockReturnValue(null);
  vi.mocked(ensureRemoteControlEnabled).mockReturnValue(false);
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
    vi.mocked(sessionExists)
      .mockReturnValueOnce(false) // cmdStart's own "already active?" guard
      .mockReturnValueOnce(false) // startSession's initial check
      .mockReturnValue(true); // alive thereafter (loop + liveness verification)
    vi.mocked(getPaneContent).mockReturnValue(LINK);
    captureLog();

    cmdStart();

    expect(newSession).toHaveBeenCalledWith(NAME, CWD, [
      "env", "-u", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
      "claude", "remote-control", "--spawn=same-dir",
    ]);
  });

  it("passes --spawn=worktree when requested", () => {
    vi.mocked(sessionExists)
      .mockReturnValueOnce(false) // cmdStart's own "already active?" guard
      .mockReturnValueOnce(false) // startSession's initial check
      .mockReturnValue(true); // alive thereafter (loop + liveness verification)
    vi.mocked(getPaneContent).mockReturnValue(LINK);
    captureLog();

    cmdStart([], { spawn: "worktree" });

    expect(newSession).toHaveBeenCalledWith(NAME, CWD, [
      "env", "-u", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
      "claude", "remote-control", "--spawn=worktree",
    ]);
  });

  it("saves spawn mode to the registry", () => {
    vi.mocked(sessionExists)
      .mockReturnValueOnce(false) // cmdStart's own "already active?" guard
      .mockReturnValueOnce(false) // startSession's initial check
      .mockReturnValue(true); // alive thereafter (loop + liveness verification)
    vi.mocked(getPaneContent).mockReturnValue(LINK);
    captureLog();

    cmdStart([], { spawn: "worktree" });

    expect(saveSessions).toHaveBeenCalledWith({
      sessions: {
        [CWD]: { name: NAME, cwd: CWD, pids: [], link: LINK, spawn: "worktree" },
      },
    });
  });

  it("starts a session and saves the captured link to the registry", () => {
    vi.mocked(sessionExists)
      .mockReturnValueOnce(false) // cmdStart's own "already active?" guard
      .mockReturnValueOnce(false) // startSession's initial check
      .mockReturnValue(true); // alive thereafter (loop + liveness verification)
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

  it("forwards extra flags verbatim to claude after --spawn", () => {
    vi.mocked(sessionExists)
      .mockReturnValueOnce(false) // cmdStart's own "already active?" guard
      .mockReturnValueOnce(false) // startSession's initial check
      .mockReturnValue(true); // alive thereafter (loop + liveness verification)
    vi.mocked(getPaneContent).mockReturnValue(LINK);
    captureLog();

    cmdStart(["--model", "opus", "--dangerously-skip-permissions"]);

    expect(newSession).toHaveBeenCalledWith(NAME, CWD, [
      "env",
      "-u",
      "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
      "claude",
      "remote-control",
      "--spawn=same-dir",
      "--model",
      "opus",
      "--dangerously-skip-permissions",
    ]);
  });

  it("persists extra flags so restore can reuse them", () => {
    vi.mocked(sessionExists)
      .mockReturnValueOnce(false) // cmdStart's own "already active?" guard
      .mockReturnValueOnce(false) // startSession's initial check
      .mockReturnValue(true); // alive thereafter (loop + liveness verification)
    vi.mocked(getPaneContent).mockReturnValue(LINK);
    captureLog();

    cmdStart(["--model", "opus"], { spawn: "worktree" });

    expect(saveSessions).toHaveBeenCalledWith({
      sessions: {
        [CWD]: {
          name: NAME,
          cwd: CWD,
          pids: [],
          link: LINK,
          spawn: "worktree",
          args: ["--model", "opus"],
        },
      },
    });
  });

  it("omits the args key from the registry when no extra flags are passed", () => {
    vi.mocked(sessionExists)
      .mockReturnValueOnce(false) // cmdStart's own "already active?" guard
      .mockReturnValueOnce(false) // startSession's initial check
      .mockReturnValue(true); // alive thereafter (loop + liveness verification)
    vi.mocked(getPaneContent).mockReturnValue(LINK);
    captureLog();

    cmdStart();

    const saved = vi.mocked(saveSessions).mock.calls[0][0];
    expect(saved.sessions[CWD]).not.toHaveProperty("args");
  });

  it("exits with an error when tmux fails to start", () => {
    vi.mocked(sessionExists)
      .mockReturnValueOnce(false) // cmdStart's own "already active?" guard
      .mockReturnValueOnce(false) // startSession's initial check
      .mockReturnValue(true); // alive thereafter (loop + liveness verification)
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
    vi.mocked(sessionExists)
      .mockReturnValueOnce(false) // cmdStart's own "already active?" guard
      .mockReturnValueOnce(false) // startSession's initial check
      .mockReturnValue(true); // alive thereafter (loop + liveness verification)
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
    vi.mocked(sessionExists)
      .mockReturnValueOnce(false) // cmdStart's own "already active?" guard
      .mockReturnValueOnce(false) // startSession's initial check
      .mockReturnValue(true); // alive thereafter (loop + liveness verification)
    vi.mocked(getPaneContent)
      .mockReturnValueOnce("booting")
      .mockReturnValueOnce(LINK);
    captureLog();

    cmdStart();

    expect(getPaneContent).toHaveBeenCalledTimes(2);
  });

  it("reports failure when the session dies immediately after launch", () => {
    // tmux creates the session (code 0) but claude exits at once, so the
    // session is already gone by the time we re-check — not a real "started".
    vi.mocked(sessionExists).mockReturnValue(false);
    const log = captureLog();
    trapExit();

    expect(() => cmdStart()).toThrow("process.exit(1)");
    expect(log.output()).toContain("session exited immediately");
    expect(saveSessions).not.toHaveBeenCalled();
  });

  it("notes when it strips the Remote Control kill-switch from settings", () => {
    vi.mocked(sessionExists)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    vi.mocked(getPaneContent).mockReturnValue(LINK);
    vi.mocked(ensureRemoteControlEnabled).mockReturnValue(true);
    const log = captureLog();

    cmdStart();

    expect(log.output()).toContain("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC");
    expect(log.output()).toContain("settings.json");
  });

  it("warns at startup when a newer crctl version is available", () => {
    vi.mocked(sessionExists)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    vi.mocked(getPaneContent).mockReturnValue(LINK);
    vi.mocked(checkUpdateAvailable).mockReturnValue("0.9.9");
    const log = captureLog();

    cmdStart([], {}, "0.9.2");

    expect(log.output()).toContain("0.9.9 is available");
    expect(log.output()).toContain("crctl update");
  });

  it("reports failure without launching when the directory no longer exists", () => {
    vi.mocked(sessionExists)
      .mockReturnValueOnce(false) // cmdStart's own "already active?" guard
      .mockReturnValueOnce(false) // startSession's initial check
      .mockReturnValue(true); // alive thereafter (loop + liveness verification)
    vi.mocked(existsSync).mockReturnValue(false);
    const log = captureLog();
    trapExit();

    expect(() => cmdStart()).toThrow("process.exit(1)");
    expect(newSession).not.toHaveBeenCalled();
    expect(log.output()).toContain("directory no longer exists");
    expect(saveSessions).not.toHaveBeenCalled();
  });
});

describe("startSession (resume mode)", () => {
  it("brings the session up with `claude --resume <id> --remote-control`", () => {
    vi.mocked(sessionExists)
      .mockReturnValueOnce(false) // startSession's initial check
      .mockReturnValue(true); // alive thereafter
    vi.mocked(getPaneContent).mockReturnValue(LINK);

    const result = startSession(CWD, "same-dir", [], { resume: "sid-abc" });

    expect(newSession).toHaveBeenCalledWith(NAME, CWD, [
      "env", "-u", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
      "claude", "--resume", "sid-abc", "--remote-control",
    ]);
    expect(result.status).toBe("started");
    expect(result.link).toBe(LINK);
  });

  it("forwards extra flags after --remote-control when resuming", () => {
    vi.mocked(sessionExists)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    vi.mocked(getPaneContent).mockReturnValue(LINK);

    startSession(CWD, "same-dir", ["--model", "opus"], { resume: "sid-abc" });

    expect(newSession).toHaveBeenCalledWith(NAME, CWD, [
      "env", "-u", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
      "claude", "--resume", "sid-abc", "--remote-control",
      "--model", "opus",
    ]);
  });

  it("uses the fresh server command when no resume id is given", () => {
    vi.mocked(sessionExists)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    vi.mocked(getPaneContent).mockReturnValue(LINK);

    startSession(CWD, "same-dir", []);

    expect(newSession).toHaveBeenCalledWith(NAME, CWD, [
      "env", "-u", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
      "claude", "remote-control", "--spawn=same-dir",
    ]);
  });
});
