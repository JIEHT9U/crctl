import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import { mkdirSync, writeFileSync } from "node:fs";
import { cmdGenerate, cmdSetup } from "../../src/commands/completions";
import {
  BASH_COMPLETION,
  FISH_COMPLETION,
  ZSH_COMPLETION,
} from "../../src/completions";
import { captureLog, trapExit } from "../helpers";

const savedShell = process.env.SHELL;

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

afterEach(() => {
  if (savedShell === undefined) delete process.env.SHELL;
  else process.env.SHELL = savedShell;
});

describe("cmdGenerate", () => {
  it.each([
    ["fish", FISH_COMPLETION],
    ["bash", BASH_COMPLETION],
    ["zsh", ZSH_COMPLETION],
  ])("prints the %s script", (shell, script) => {
    const log = captureLog();

    cmdGenerate(shell);

    expect(log.output()).toBe(script.trim());
  });

  it("exits 1 for an unsupported shell", () => {
    const log = captureLog();
    trapExit();

    expect(() => cmdGenerate("powershell")).toThrow("process.exit(1)");
    expect(log.output()).toContain("Unknown shell: powershell");
    expect(log.output()).toContain("bash, fish, zsh");
  });
});

describe("cmdSetup", () => {
  it("installs fish completions into ~/.config/fish/completions", () => {
    process.env.SHELL = "/usr/bin/fish";
    const log = captureLog();

    cmdSetup();

    const target = join(homedir(), ".config", "fish", "completions", "crctl.fish");
    expect(mkdirSync).toHaveBeenCalledWith(
      join(homedir(), ".config", "fish", "completions"),
      { recursive: true }
    );
    expect(writeFileSync).toHaveBeenCalledWith(target, FISH_COMPLETION.trim());
    expect(log.output()).toContain("Auto-completion installed");
  });

  it("installs bash completions into ~/.bash_completion_crctl", () => {
    process.env.SHELL = "/bin/bash";
    const log = captureLog();

    cmdSetup();

    expect(writeFileSync).toHaveBeenCalledWith(
      join(homedir(), ".bash_completion_crctl"),
      BASH_COMPLETION.trim()
    );
    expect(log.output()).toContain("Add to ~/.bashrc");
  });

  it("installs zsh completions into the oh-my-zsh plugin dir", () => {
    process.env.SHELL = "/bin/zsh";
    const log = captureLog();

    cmdSetup();

    const dir = join(homedir(), ".oh-my-zsh", "custom", "plugins", "crctl");
    expect(mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
    expect(writeFileSync).toHaveBeenCalledWith(
      join(dir, "_crctl"),
      ZSH_COMPLETION.trim()
    );
    expect(log.output()).toContain("plugins in ~/.zshrc");
  });

  it("falls back to manual instructions when writing fails", () => {
    process.env.SHELL = "/usr/bin/fish";
    vi.mocked(writeFileSync).mockImplementation(() => {
      throw new Error("EACCES");
    });
    const log = captureLog();

    cmdSetup();

    expect(log.output()).toContain("Install manually");
    expect(log.output()).toContain("crctl generate fish");
  });
});
