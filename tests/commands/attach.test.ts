import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/tmux", () => ({
  sessionExists: vi.fn(),
  attachSession: vi.fn(),
}));

import { cmdAttach } from "../../src/commands/attach";
import { attachSession, sessionExists } from "../../src/tmux";
import { sessionName } from "../../src/utils";
import { captureLog, mockCwd, trapExit } from "../helpers";

const CWD = "/home/user/project";
const NAME = sessionName(CWD);

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  mockCwd(CWD);
});

describe("cmdAttach", () => {
  it("attaches to the current directory's session", () => {
    vi.mocked(sessionExists).mockReturnValue(true);
    vi.mocked(attachSession).mockReturnValue(0);
    captureLog();

    cmdAttach();

    expect(attachSession).toHaveBeenCalledWith(NAME);
  });

  it("exits 1 with a hint when there is no session", () => {
    vi.mocked(sessionExists).mockReturnValue(false);
    const log = captureLog();
    trapExit();

    expect(() => cmdAttach()).toThrow("process.exit(1)");
    expect(attachSession).not.toHaveBeenCalled();
    expect(log.output()).toContain("crctl start");
  });

  it("propagates a non-zero tmux exit code", () => {
    vi.mocked(sessionExists).mockReturnValue(true);
    vi.mocked(attachSession).mockReturnValue(1);
    captureLog();
    trapExit();

    expect(() => cmdAttach()).toThrow("process.exit(1)");
  });
});
