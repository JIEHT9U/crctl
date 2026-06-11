import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/tmux", () => ({
  sessionExists: vi.fn(),
  killSession: vi.fn(),
}));
vi.mock("../../src/registry", () => ({
  loadSessions: vi.fn(),
  saveSessions: vi.fn(),
}));
vi.mock("../../src/processes", () => ({
  findClaudeProcesses: vi.fn(),
  killPids: vi.fn(),
}));
vi.mock("../../src/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/utils")>()),
  sleep: vi.fn(),
}));

import { cmdStop } from "../../src/commands/stop";
import { findClaudeProcesses, killPids } from "../../src/processes";
import { loadSessions, saveSessions } from "../../src/registry";
import { killSession, sessionExists } from "../../src/tmux";
import { sessionName } from "../../src/utils";
import { captureLog, mockCwd } from "../helpers";

const CWD = "/home/user/project";
const NAME = sessionName(CWD);
const OTHER_CWD = "/home/user/other";
const OTHER_NAME = sessionName(OTHER_CWD);

function registryWith(cwds: string[]) {
  const sessions: Record<string, any> = {};
  for (const cwd of cwds) {
    sessions[cwd] = { name: sessionName(cwd), cwd, pids: [] };
  }
  return { sessions };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  mockCwd(CWD);
  vi.mocked(findClaudeProcesses).mockReturnValue([]);
});

describe("cmdStop (current directory)", () => {
  it("kills the current directory's session and removes it from the registry", () => {
    vi.mocked(loadSessions).mockReturnValue(registryWith([CWD]));
    vi.mocked(sessionExists).mockImplementation((n) => n === NAME);
    const log = captureLog();

    cmdStop({});

    expect(killSession).toHaveBeenCalledWith(NAME);
    expect(saveSessions).toHaveBeenCalledWith({ sessions: {} });
    expect(log.output()).toContain("Session and all processes terminated");
  });

  it("kills orphaned claude processes when no other session is active", () => {
    vi.mocked(loadSessions).mockReturnValue(registryWith([CWD]));
    vi.mocked(sessionExists).mockImplementation((n) => n === NAME);
    vi.mocked(findClaudeProcesses).mockReturnValue([4242]);
    captureLog();

    cmdStop({});

    expect(killPids).toHaveBeenCalledWith([4242]);
  });

  it("does NOT kill claude processes belonging to other live sessions", () => {
    // Regression: `crctl stop` in dir A used to SIGKILL the claude
    // processes of the still-running session in dir B.
    vi.mocked(loadSessions).mockReturnValue(registryWith([CWD, OTHER_CWD]));
    vi.mocked(sessionExists).mockReturnValue(true); // both sessions live
    vi.mocked(findClaudeProcesses).mockReturnValue([4242]);
    captureLog();

    cmdStop({});

    expect(killSession).toHaveBeenCalledWith(NAME);
    expect(killSession).not.toHaveBeenCalledWith(OTHER_NAME);
    expect(killPids).not.toHaveBeenCalled();
  });

  it("reports a clean state when nothing is running", () => {
    vi.mocked(loadSessions).mockReturnValue({ sessions: {} });
    vi.mocked(sessionExists).mockReturnValue(false);
    const log = captureLog();

    cmdStop({});

    expect(killSession).not.toHaveBeenCalled();
    expect(log.output()).toContain("Session not found. All clean.");
  });

  it("cleans up orphans even when the session itself is gone", () => {
    vi.mocked(loadSessions).mockReturnValue({ sessions: {} });
    vi.mocked(sessionExists).mockReturnValue(false);
    vi.mocked(findClaudeProcesses).mockReturnValue([1111]);
    const log = captureLog();

    cmdStop({});

    expect(killPids).toHaveBeenCalledWith([1111]);
    expect(log.output()).toContain("Processes terminated");
  });
});

describe("cmdStop --global", () => {
  it("reports when there is nothing to stop", () => {
    vi.mocked(loadSessions).mockReturnValue({ sessions: {} });
    const log = captureLog();

    cmdStop({ global: true });

    expect(killSession).not.toHaveBeenCalled();
    expect(log.output()).toContain("No active sessions");
  });

  it("kills every active session and sweeps orphans", () => {
    vi.mocked(loadSessions).mockReturnValue(registryWith([CWD, OTHER_CWD]));
    vi.mocked(sessionExists).mockReturnValue(true);
    vi.mocked(findClaudeProcesses).mockReturnValue([4242]);
    const log = captureLog();

    cmdStop({ global: true });

    expect(killSession).toHaveBeenCalledWith(NAME);
    expect(killSession).toHaveBeenCalledWith(OTHER_NAME);
    expect(killPids).toHaveBeenCalledWith([4242]);
    expect(saveSessions).toHaveBeenCalledWith({ sessions: {} });
    expect(log.output()).toContain("All sessions stopped");
  });

  it("skips registry entries whose tmux session is already gone", () => {
    vi.mocked(loadSessions).mockReturnValue(registryWith([CWD, OTHER_CWD]));
    vi.mocked(sessionExists).mockImplementation((n) => n === NAME);
    captureLog();

    cmdStop({ global: true });

    expect(killSession).toHaveBeenCalledTimes(1);
    expect(killSession).toHaveBeenCalledWith(NAME);
  });
});
