import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/tmux", () => ({
  sessionExists: vi.fn(),
  getPanePid: vi.fn(),
  listCrctlSessions: vi.fn(),
}));
vi.mock("../../src/registry", () => ({
  loadSessions: vi.fn(),
}));
vi.mock("../../src/processes", () => ({
  findClaudeProcesses: vi.fn(),
}));

import { cmdStatus } from "../../src/commands/status";
import { findClaudeProcesses } from "../../src/processes";
import { loadSessions } from "../../src/registry";
import { getPanePid, listCrctlSessions, sessionExists } from "../../src/tmux";
import { sessionName } from "../../src/utils";
import { captureLog, mockCwd } from "../helpers";

const CWD = "/home/user/project";
const NAME = sessionName(CWD);
const OTHER_CWD = "/home/user/other";
const LINK = "https://claude.ai/code?environment=abc123";

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  mockCwd(CWD);
  vi.mocked(loadSessions).mockReturnValue({ sessions: {} });
  vi.mocked(findClaudeProcesses).mockReturnValue([]);
  vi.mocked(getPanePid).mockReturnValue("4242");
  vi.mocked(listCrctlSessions).mockReturnValue([]);
});

describe("cmdStatus (current directory)", () => {
  it("shows session details with link and pid when active", () => {
    vi.mocked(sessionExists).mockReturnValue(true);
    vi.mocked(loadSessions).mockReturnValue({
      sessions: { [CWD]: { name: NAME, cwd: CWD, pids: [], link: LINK } },
    });
    const log = captureLog();

    cmdStatus({});

    const out = log.output();
    expect(out).toContain(`✅ Session active for ${CWD}`);
    expect(out).toContain(NAME);
    expect(out).toContain(LINK);
    expect(out).toContain("4242");
  });

  it("reports a missing session", () => {
    vi.mocked(sessionExists).mockReturnValue(false);
    const log = captureLog();

    cmdStatus({});

    expect(log.output()).toContain(`❌ Session not running for ${CWD}`);
    expect(log.output()).not.toContain("orphaned");
  });

  it("warns about orphaned processes when none can belong to another session", () => {
    vi.mocked(sessionExists).mockReturnValue(false);
    vi.mocked(findClaudeProcesses).mockReturnValue([1111]);
    const log = captureLog();

    cmdStatus({});

    expect(log.output()).toContain("orphaned processes: 1111");
    expect(log.output()).toContain("crctl stop");
  });

  it("does not flag other live sessions' processes as orphans", () => {
    vi.mocked(loadSessions).mockReturnValue({
      sessions: {
        [OTHER_CWD]: {
          name: sessionName(OTHER_CWD),
          cwd: OTHER_CWD,
          pids: [],
        },
      },
    });
    // Current dir has no session, the other one is alive
    vi.mocked(sessionExists).mockImplementation(
      (n) => n === sessionName(OTHER_CWD)
    );
    vi.mocked(findClaudeProcesses).mockReturnValue([1111]);
    const log = captureLog();

    cmdStatus({});

    expect(log.output()).not.toContain("orphaned");
  });
});

describe("cmdStatus --global", () => {
  it("lists every active session from the registry", () => {
    vi.mocked(loadSessions).mockReturnValue({
      sessions: {
        [CWD]: { name: NAME, cwd: CWD, pids: [], link: LINK },
        [OTHER_CWD]: {
          name: sessionName(OTHER_CWD),
          cwd: OTHER_CWD,
          pids: [],
        },
      },
    });
    vi.mocked(sessionExists).mockReturnValue(true);
    const log = captureLog();

    cmdStatus({ global: true });

    const out = log.output();
    expect(out).toContain("Active crctl sessions");
    expect(out).toContain(CWD);
    expect(out).toContain(OTHER_CWD);
    expect(out).toContain(LINK);
  });

  it("falls back to tmux when the registry is empty", () => {
    vi.mocked(listCrctlSessions).mockReturnValue([
      { name: "claude-rc-deadbeef", path: "/somewhere" },
    ]);
    const log = captureLog();

    cmdStatus({ global: true });

    expect(log.output()).toContain("/somewhere");
    expect(log.output()).toContain("claude-rc-deadbeef");
  });

  it("reports when nothing is running anywhere", () => {
    const log = captureLog();

    cmdStatus({ global: true });

    expect(log.output()).toContain("No active crctl sessions");
  });
});
