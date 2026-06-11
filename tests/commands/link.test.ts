import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/tmux", () => ({
  sessionExists: vi.fn(),
  getPaneContent: vi.fn(),
}));
vi.mock("../../src/registry", () => ({
  loadSessions: vi.fn(),
  saveSessions: vi.fn(),
}));

import { cmdLink } from "../../src/commands/link";
import { loadSessions, saveSessions } from "../../src/registry";
import { getPaneContent, sessionExists } from "../../src/tmux";
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
  vi.mocked(sessionExists).mockReturnValue(false);
  vi.mocked(getPaneContent).mockReturnValue("");
});

describe("cmdLink", () => {
  it("prints the link from the registry when present", () => {
    vi.mocked(loadSessions).mockReturnValue({
      sessions: { [CWD]: { name: NAME, cwd: CWD, pids: [], link: LINK } },
    });
    const log = captureLog();

    cmdLink();

    expect(log.output()).toBe(LINK);
    expect(saveSessions).not.toHaveBeenCalled();
  });

  it("recovers the link from the live pane when the registry has no entry", () => {
    // Regression: this used to crash with `entry is undefined` because the
    // code assigned `entry.link` without checking that the entry existed.
    vi.mocked(sessionExists).mockReturnValue(true);
    vi.mocked(getPaneContent).mockReturnValue(`noise\n${LINK}\nnoise`);
    const log = captureLog();

    expect(() => cmdLink()).not.toThrow();
    expect(log.output()).toBe(LINK);
    expect(saveSessions).toHaveBeenCalledWith({
      sessions: { [CWD]: { name: NAME, cwd: CWD, pids: [], link: LINK } },
    });
  });

  it("updates an existing registry entry that is missing its link", () => {
    vi.mocked(loadSessions).mockReturnValue({
      sessions: { [CWD]: { name: NAME, cwd: CWD, pids: [7], link: null } },
    });
    vi.mocked(sessionExists).mockReturnValue(true);
    vi.mocked(getPaneContent).mockReturnValue(LINK);
    captureLog();

    cmdLink();

    expect(saveSessions).toHaveBeenCalledWith({
      sessions: { [CWD]: { name: NAME, cwd: CWD, pids: [7], link: LINK } },
    });
  });

  it("exits 1 when no link can be found anywhere", () => {
    const log = captureLog();
    trapExit();

    expect(() => cmdLink()).toThrow("process.exit(1)");
    expect(log.output()).toContain("Link not found");
  });
});
