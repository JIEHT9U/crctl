import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/tmux", () => ({
  sessionExists: vi.fn(),
  attachSession: vi.fn(),
  detachSession: vi.fn(),
}));

import { cmdAttach, cmdDetach } from "../../src/commands/attach";
import { attachSession, detachSession, sessionExists } from "../../src/tmux";
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
  it("prints the detach hint before attaching", () => {
    vi.mocked(sessionExists).mockReturnValue(true);
    vi.mocked(attachSession).mockReturnValue(0);
    const log = captureLog();

    cmdAttach();

    expect(log.output()).toContain("Ctrl+B D");
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

describe("cmdDetach", () => {
  it("detaches all clients from the current directory's session", () => {
    vi.mocked(sessionExists).mockReturnValue(true);
    vi.mocked(detachSession).mockReturnValue(0);
    const log = captureLog();

    cmdDetach();

    expect(detachSession).toHaveBeenCalledWith(NAME);
    expect(log.output()).toContain("Detached");
    expect(log.output()).toContain("crctl attach");
  });

  it("exits 1 when there is no session", () => {
    vi.mocked(sessionExists).mockReturnValue(false);
    captureLog();
    trapExit();

    expect(() => cmdDetach()).toThrow("process.exit(1)");
    expect(detachSession).not.toHaveBeenCalled();
  });

  it("exits 1 when detach fails", () => {
    vi.mocked(sessionExists).mockReturnValue(true);
    vi.mocked(detachSession).mockReturnValue(1);
    const log = captureLog();
    trapExit();

    expect(() => cmdDetach()).toThrow("process.exit(1)");
    expect(log.output()).toContain("Could not detach");
  });
});
