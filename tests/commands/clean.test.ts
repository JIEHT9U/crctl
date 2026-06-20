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

import { cmdClean } from "../../src/commands/clean";
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

describe("cmdClean (current directory)", () => {
  it("removes a stale entry whose session is dead", () => {
    vi.mocked(loadSessions).mockReturnValue(registryWith([CWD]));
    vi.mocked(sessionExists).mockReturnValue(false);
    const log = captureLog();

    cmdClean({});

    expect(killSession).not.toHaveBeenCalled();
    expect(saveSessions).toHaveBeenCalledWith({ sessions: {} });
    expect(log.output()).toContain("Removed stale registry entry");
  });

  it("refuses to touch a live session without --force", () => {
    vi.mocked(loadSessions).mockReturnValue(registryWith([CWD]));
    vi.mocked(sessionExists).mockReturnValue(true);
    const log = captureLog();

    cmdClean({});

    expect(killSession).not.toHaveBeenCalled();
    expect(saveSessions).not.toHaveBeenCalled();
    expect(log.output()).toContain("still running");
    expect(log.output()).toContain("crctl stop");
  });

  it("kills the live session and removes the entry with --force", () => {
    vi.mocked(loadSessions).mockReturnValue(registryWith([CWD]));
    vi.mocked(sessionExists).mockImplementation((n) => n === NAME);
    const log = captureLog();

    cmdClean({ force: true });

    expect(killSession).toHaveBeenCalledWith(NAME);
    expect(saveSessions).toHaveBeenCalledWith({ sessions: {} });
    expect(log.output()).toContain("Killed session and removed");
  });

  it("sweeps orphans with --force only when no other session is live", () => {
    vi.mocked(loadSessions).mockReturnValue(registryWith([CWD]));
    vi.mocked(sessionExists).mockImplementation((n) => n === NAME);
    vi.mocked(findClaudeProcesses).mockReturnValue([4242]);
    captureLog();

    cmdClean({ force: true });

    expect(killPids).toHaveBeenCalledWith([4242]);
  });

  it("does NOT sweep orphans of another live session with --force", () => {
    vi.mocked(loadSessions).mockReturnValue(registryWith([CWD, OTHER_CWD]));
    vi.mocked(sessionExists).mockReturnValue(true); // both live
    vi.mocked(findClaudeProcesses).mockReturnValue([4242]);
    captureLog();

    cmdClean({ force: true });

    expect(killSession).toHaveBeenCalledWith(NAME);
    expect(killSession).not.toHaveBeenCalledWith(OTHER_NAME);
    expect(killPids).not.toHaveBeenCalled();
  });

  it("reports when there is no entry for the directory", () => {
    vi.mocked(loadSessions).mockReturnValue({ sessions: {} });
    vi.mocked(sessionExists).mockReturnValue(false);
    const log = captureLog();

    cmdClean({});

    expect(saveSessions).not.toHaveBeenCalled();
    expect(log.output()).toContain("nothing to clean");
  });
});

describe("cmdClean --global", () => {
  it("reports an empty registry", () => {
    vi.mocked(loadSessions).mockReturnValue({ sessions: {} });
    const log = captureLog();

    cmdClean({ global: true });

    expect(saveSessions).not.toHaveBeenCalled();
    expect(log.output()).toContain("Registry is empty");
  });

  it("removes only dead entries, keeping live ones", () => {
    vi.mocked(loadSessions).mockReturnValue(registryWith([CWD, OTHER_CWD]));
    // CWD live, OTHER dead
    vi.mocked(sessionExists).mockImplementation((n) => n === NAME);
    const log = captureLog();

    cmdClean({ global: true });

    expect(killSession).not.toHaveBeenCalled();
    expect(saveSessions).toHaveBeenCalledWith({
      sessions: { [CWD]: { name: NAME, cwd: CWD, pids: [] } },
    });
    const out = log.output();
    expect(out).toContain(OTHER_CWD);
    expect(out).toContain("dead");
    expect(out).toContain("untouched");
  });

  it("reports when every entry is live and none are removed", () => {
    vi.mocked(loadSessions).mockReturnValue(registryWith([CWD]));
    vi.mocked(sessionExists).mockReturnValue(true);
    const log = captureLog();

    cmdClean({ global: true });

    expect(log.output()).toContain("No stale entries to clean");
  });

  it("with --force kills every live session and prunes the whole registry", () => {
    vi.mocked(loadSessions).mockReturnValue(registryWith([CWD, OTHER_CWD]));
    vi.mocked(sessionExists).mockReturnValue(true);
    vi.mocked(findClaudeProcesses).mockReturnValue([4242]);
    const log = captureLog();

    cmdClean({ global: true, force: true });

    expect(killSession).toHaveBeenCalledWith(NAME);
    expect(killSession).toHaveBeenCalledWith(OTHER_NAME);
    expect(killPids).toHaveBeenCalledWith([4242]);
    expect(saveSessions).toHaveBeenCalledWith({ sessions: {} });
    expect(log.output()).toContain("killed (--force)");
  });
});
