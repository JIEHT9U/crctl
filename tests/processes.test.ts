import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({ execSync: vi.fn() }));

import { execSync } from "node:child_process";
import {
  findClaudeProcesses,
  killPids,
  parseClaudePids,
} from "../src/processes";

const mockExecSync = vi.mocked(execSync);

const PS_OUTPUT = [
  "USER  PID  %CPU %MEM COMMAND",
  "user  1234 0.5  1.0  claude remote-control",
  "user  5678 0.1  0.5  /usr/local/bin/claude remote-control --verbose",
  "user  9999 0.0  0.1  vim claude-notes.md",
  "user  4242 0.0  0.1  tmux new-session",
  "garbage line",
].join("\n");

describe("parseClaudePids", () => {
  it("returns pids of claude remote-control processes only", () => {
    expect(parseClaudePids(PS_OUTPUT, 0)).toEqual([1234, 5678]);
  });

  it("excludes the given pid (our own process)", () => {
    expect(parseClaudePids(PS_OUTPUT, 1234)).toEqual([5678]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(parseClaudePids("user 1 0.0 0.0 init", 0)).toEqual([]);
    expect(parseClaudePids("", 0)).toEqual([]);
  });

  it("ignores lines where the pid is not a number", () => {
    expect(
      parseClaudePids("user abc 0.0 0.0 claude remote-control", 0)
    ).toEqual([]);
  });
});

describe("findClaudeProcesses", () => {
  // Braces matter: returning the mock from beforeEach would make vitest
  // call it as a teardown function after the test.
  beforeEach(() => {
    mockExecSync.mockReset();
  });

  it("parses ps aux output", () => {
    mockExecSync.mockReturnValue(PS_OUTPUT as any);
    expect(findClaudeProcesses()).toEqual([1234, 5678]);
    expect(mockExecSync).toHaveBeenCalledWith("ps aux", { encoding: "utf8" });
  });

  it("returns an empty list when ps fails", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("ps not found");
    });
    expect(findClaudeProcesses()).toEqual([]);
  });
});

describe("killPids", () => {
  let killSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    killSpy = vi.spyOn(process, "kill").mockReturnValue(true as any);
  });

  afterEach(() => {
    killSpy.mockRestore();
  });

  it("sends SIGKILL to every pid", () => {
    killPids([111, 222]);
    expect(killSpy).toHaveBeenCalledWith(111, 9);
    expect(killSpy).toHaveBeenCalledWith(222, 9);
  });

  it("ignores already-dead processes", () => {
    killSpy.mockImplementation(() => {
      throw new Error("ESRCH");
    });
    expect(() => killPids([111])).not.toThrow();
  });
});
