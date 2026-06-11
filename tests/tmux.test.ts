import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));

import { spawnSync } from "node:child_process";
import {
  attachSession,
  getPaneContent,
  getPanePid,
  killSession,
  listCrctlSessions,
  newSession,
  parseSessionList,
  run,
  sessionExists,
} from "../src/tmux";

const mockSpawnSync = vi.mocked(spawnSync);

function spawnResult(overrides: Partial<{ stdout: string; stderr: string; status: number | null }> = {}) {
  return {
    stdout: "",
    stderr: "",
    status: 0,
    ...overrides,
  } as any;
}

beforeEach(() => {
  mockSpawnSync.mockReset();
  mockSpawnSync.mockReturnValue(spawnResult());
});

describe("run", () => {
  it("trims stdout/stderr and returns the exit code", () => {
    mockSpawnSync.mockReturnValue(
      spawnResult({ stdout: "  hello \n", stderr: " oops \n", status: 2 })
    );
    expect(run("cmd", ["arg"])).toEqual({
      stdout: "hello",
      stderr: "oops",
      code: 2,
    });
  });

  it("handles missing output and null status (command not found)", () => {
    mockSpawnSync.mockReturnValue(
      spawnResult({ stdout: undefined as any, stderr: undefined as any, status: null })
    );
    expect(run("nope", [])).toEqual({ stdout: "", stderr: "", code: null });
  });

  it("captures output instead of inheriting stdio", () => {
    run("tmux", ["-V"]);
    const opts = mockSpawnSync.mock.calls[0][2] as any;
    expect(opts.encoding).toBe("utf8");
    expect(opts.stdio).toBeUndefined();
  });
});

describe("sessionExists", () => {
  it("returns true when tmux has-session exits 0", () => {
    expect(sessionExists("claude-rc-x")).toBe(true);
    expect(mockSpawnSync).toHaveBeenCalledWith(
      "tmux",
      ["has-session", "-t", "claude-rc-x"],
      expect.anything()
    );
  });

  it("returns false otherwise", () => {
    mockSpawnSync.mockReturnValue(spawnResult({ status: 1 }));
    expect(sessionExists("claude-rc-x")).toBe(false);
  });
});

describe("newSession / killSession", () => {
  it("creates a detached session running the command in cwd", () => {
    newSession("s1", "/proj", ["claude", "remote-control"]);
    expect(mockSpawnSync).toHaveBeenCalledWith(
      "tmux",
      ["new-session", "-d", "-s", "s1", "-c", "/proj", "claude", "remote-control"],
      expect.anything()
    );
  });

  it("kills the named session", () => {
    killSession("s1");
    expect(mockSpawnSync).toHaveBeenCalledWith(
      "tmux",
      ["kill-session", "-t", "s1"],
      expect.anything()
    );
  });
});

describe("attachSession", () => {
  const savedTmux = process.env.TMUX;

  afterEach(() => {
    if (savedTmux === undefined) delete process.env.TMUX;
    else process.env.TMUX = savedTmux;
  });

  it("inherits stdio so tmux gets a real terminal", () => {
    delete process.env.TMUX;
    attachSession("s1");
    expect(mockSpawnSync).toHaveBeenCalledWith(
      "tmux",
      ["attach-session", "-t", "s1"],
      { stdio: "inherit" }
    );
  });

  it("uses switch-client when already inside tmux", () => {
    process.env.TMUX = "/tmp/tmux-1000/default,123,0";
    attachSession("s1");
    expect(mockSpawnSync).toHaveBeenCalledWith(
      "tmux",
      ["switch-client", "-t", "s1"],
      { stdio: "inherit" }
    );
  });

  it("returns the tmux exit code", () => {
    delete process.env.TMUX;
    mockSpawnSync.mockReturnValue(spawnResult({ status: 1 }));
    expect(attachSession("s1")).toBe(1);
  });
});

describe("getPaneContent", () => {
  it("captures the pane and strips carriage returns", () => {
    mockSpawnSync.mockReturnValue(spawnResult({ stdout: "line1\r\nline2\r" }));
    expect(getPaneContent("s1")).toBe("line1\nline2");
    expect(mockSpawnSync).toHaveBeenCalledWith(
      "tmux",
      ["capture-pane", "-t", "s1", "-p", "-S", "-50", "-J"],
      expect.anything()
    );
  });
});

describe("getPanePid", () => {
  it("returns the pane pid", () => {
    mockSpawnSync.mockReturnValue(spawnResult({ stdout: "4242\n" }));
    expect(getPanePid("s1")).toBe("4242");
  });

  it("falls back to a dash when unavailable", () => {
    mockSpawnSync.mockReturnValue(spawnResult({ stdout: "", status: 1 }));
    expect(getPanePid("s1")).toBe("—");
  });
});

describe("parseSessionList", () => {
  it("keeps only crctl sessions and splits name from path", () => {
    const out = [
      "claude-rc-abc12345 /home/user/project a",
      "other-session /home/user/elsewhere",
      "claude-rc-def67890 /home/user/with space/dir",
    ].join("\n");
    expect(parseSessionList(out)).toEqual([
      { name: "claude-rc-abc12345", path: "/home/user/project a" },
      { name: "claude-rc-def67890", path: "/home/user/with space/dir" },
    ]);
  });

  it("returns an empty list for empty output", () => {
    expect(parseSessionList("")).toEqual([]);
    expect(parseSessionList("\n\n")).toEqual([]);
  });
});

describe("listCrctlSessions", () => {
  it("queries tmux and parses the result", () => {
    mockSpawnSync.mockReturnValue(
      spawnResult({ stdout: "claude-rc-abc12345 /proj" })
    );
    expect(listCrctlSessions()).toEqual([
      { name: "claude-rc-abc12345", path: "/proj" },
    ]);
  });
});
