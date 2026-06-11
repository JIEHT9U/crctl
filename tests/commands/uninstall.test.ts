import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  rmSync: vi.fn(),
}));

import {
  existsSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { cmdUninstall } from "../../src/commands/uninstall";
import { CONFIG_DIR } from "../../src/constants";
import { captureLog } from "../helpers";

const savedShell = process.env.SHELL;

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  process.env.SHELL = "/bin/bash";
  vi.mocked(existsSync).mockReturnValue(false);
});

afterEach(() => {
  if (savedShell === undefined) delete process.env.SHELL;
  else process.env.SHELL = savedShell;
});

describe("cmdUninstall", () => {
  it("removes the binary", () => {
    const log = captureLog();

    cmdUninstall();

    expect(unlinkSync).toHaveBeenCalledWith(process.argv[1]);
    expect(log.output()).toContain("Binary removed");
  });

  it("survives a binary that cannot be removed", () => {
    vi.mocked(unlinkSync).mockImplementation(() => {
      throw new Error("EACCES");
    });
    const log = captureLog();

    expect(() => cmdUninstall()).not.toThrow();
    expect(log.output()).toContain("Could not remove binary");
  });

  it("removes crctl lines from the shell config, keeping the rest", () => {
    const bashrc = join(homedir(), ".bashrc");
    vi.mocked(existsSync).mockImplementation((p) => p === bashrc);
    vi.mocked(readFileSync).mockReturnValue(
      ["export PATH=$PATH:/usr/local/bin", 'export PATH="$HOME/.crctl/bin:$PATH"', "alias ll='ls -l'"].join("\n") as any
    );
    captureLog();

    cmdUninstall();

    expect(writeFileSync).toHaveBeenCalledWith(
      bashrc,
      ["export PATH=$PATH:/usr/local/bin", "alias ll='ls -l'"].join("\n")
    );
  });

  it("leaves the shell config untouched when it has no crctl lines", () => {
    const bashrc = join(homedir(), ".bashrc");
    vi.mocked(existsSync).mockImplementation((p) => p === bashrc);
    vi.mocked(readFileSync).mockReturnValue("alias ll='ls -l'" as any);
    captureLog();

    cmdUninstall();

    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it("removes installed completion files", () => {
    const fishCompletion = join(
      homedir(),
      ".config",
      "fish",
      "completions",
      "crctl.fish"
    );
    vi.mocked(existsSync).mockImplementation((p) => p === fishCompletion);
    const log = captureLog();

    cmdUninstall();

    expect(unlinkSync).toHaveBeenCalledWith(fishCompletion);
    expect(log.output()).toContain("Removed completion");
  });

  it("removes the config directory (session registry)", () => {
    vi.mocked(existsSync).mockImplementation((p) => p === CONFIG_DIR);
    const log = captureLog();

    cmdUninstall();

    expect(rmSync).toHaveBeenCalledWith(CONFIG_DIR, {
      recursive: true,
      force: true,
    });
    expect(log.output()).toContain("Removed config");
  });
});
