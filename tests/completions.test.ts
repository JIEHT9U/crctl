import { describe, expect, it } from "vitest";
import {
  BASH_COMPLETION,
  FISH_COMPLETION,
  getCompletionScript,
  SUPPORTED_SHELLS,
  ZSH_COMPLETION,
} from "../src/completions";

const ALL_COMMANDS = [
  "start",
  "stop",
  "status",
  "attach",
  "link",
  "doctor",
  "setup",
  "generate",
  "update",
  "uninstall",
];

describe("getCompletionScript", () => {
  it("returns a script for every supported shell", () => {
    for (const shell of SUPPORTED_SHELLS) {
      expect(getCompletionScript(shell)).toBeTruthy();
    }
  });

  it("returns null for unknown shells", () => {
    expect(getCompletionScript("powershell")).toBeNull();
    expect(getCompletionScript("")).toBeNull();
  });
});

describe.each([
  ["fish", FISH_COMPLETION],
  ["bash", BASH_COMPLETION],
  ["zsh", ZSH_COMPLETION],
])("%s completion", (_shell, script) => {
  it("mentions every command", () => {
    for (const cmd of ALL_COMMANDS) {
      expect(script).toContain(cmd);
    }
  });

  it("offers the supported shells for `generate`", () => {
    expect(script).toContain("bash fish zsh");
  });
});

describe("fish completion", () => {
  it("inspects tokens before the cursor (not just the current token)", () => {
    // `commandline -ct` returns only the token being typed, which broke
    // subcommand detection; -opc returns all tokens before the cursor.
    expect(FISH_COMPLETION).toContain("commandline -opc");
    expect(FISH_COMPLETION).not.toContain("commandline -ct");
  });

  it("does not use deprecated fish helpers", () => {
    expect(FISH_COMPLETION).not.toContain("__fish_seen_short_option");
  });
});

describe("bash completion", () => {
  it("registers the completion function", () => {
    expect(BASH_COMPLETION).toContain("complete -F _crctl crctl");
  });
});

describe("zsh completion", () => {
  it("starts with the compdef directive", () => {
    expect(ZSH_COMPLETION.trim().startsWith("#compdef crctl")).toBe(true);
  });

  it('ends by dispatching with "$@" (not a literal \\@)', () => {
    expect(ZSH_COMPLETION).toContain('_crctl "$@"');
    expect(ZSH_COMPLETION).not.toContain("\\@");
  });
});
