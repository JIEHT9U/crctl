import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * End-to-end smoke test: builds the real binary once and exercises the
 * commands that are safe to run anywhere (no tmux sessions touched).
 */

const ROOT = process.cwd();
const BIN = join(ROOT, "dist", "index.cjs");

function crctl(args: string): string {
  return execSync(`node ${BIN} ${args}`, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

beforeAll(() => {
  execSync("npm run build", { cwd: ROOT, stdio: "pipe" });
  expect(existsSync(BIN)).toBe(true);
}, 120_000);

describe("crctl binary", () => {
  it("prints the package version", () => {
    const pkg = JSON.parse(
      execSync("cat package.json", { cwd: ROOT, encoding: "utf8" })
    );
    expect(crctl("--version").trim()).toBe(pkg.version);
  });

  it("lists every command in --help", () => {
    const help = crctl("--help");
    for (const cmd of [
      "start",
      "stop",
      "status",
      "attach",
      "link",
      "doctor",
      "generate",
      "setup",
      "update",
      "uninstall",
    ]) {
      expect(help).toContain(cmd);
    }
  });

  it("documents the --global flag for stop and status", () => {
    expect(crctl("stop --help")).toContain("--global");
    expect(crctl("status --help")).toContain("--global");
  });

  it("generates completions for every shell", () => {
    expect(crctl("generate bash")).toContain("complete -F _crctl crctl");
    expect(crctl("generate fish")).toContain("complete -c crctl");
    expect(crctl("generate zsh")).toContain("#compdef crctl");
  });

  it("fails with exit code 1 for an unknown completion shell", () => {
    expect(() => crctl("generate powershell")).toThrow();
  });

  it("runs doctor without crashing", () => {
    const out = crctl("doctor");
    expect(out).toContain("Node.js");
    expect(out).toContain("tmux");
    expect(out).toContain("claude");
  });
});
