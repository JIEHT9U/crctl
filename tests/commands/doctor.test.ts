import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/tmux", () => ({
  run: vi.fn(),
}));

import { buildChecks, cmdDoctor } from "../../src/commands/doctor";
import { run } from "../../src/tmux";
import { captureLog } from "../helpers";

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.mocked(run).mockReturnValue({ stdout: "tmux 3.4", stderr: "", code: 0 });
  delete process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC;
});

describe("buildChecks", () => {
  it("covers Node.js, tmux, claude, Remote Control, shell and platform", () => {
    const names = buildChecks().map((c) => c.name);
    expect(names).toEqual([
      "Node.js", "tmux", "claude", "Remote Control", "Shell", "Platform",
    ]);
  });

  it("flags the Remote Control traffic kill-switch when it is set", () => {
    const rc = () => buildChecks().find((c) => c.name === "Remote Control")!;

    expect(rc().check()).toEqual({ ok: true, info: "ready" });

    process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
    const set = rc().check();
    expect(set.ok).toBe(true); // crctl strips it, so not a hard failure
    expect(set.info).toContain("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC");
  });

  it("uses the current process version for Node.js (no subprocess)", () => {
    const node = buildChecks().find((c) => c.name === "Node.js")!;
    expect(node.check()).toEqual({ ok: true, info: process.version });
  });

  it("marks tmux as missing when the binary is not found", () => {
    vi.mocked(run).mockReturnValue({ stdout: "", stderr: "", code: null });
    const tmux = buildChecks().find((c) => c.name === "tmux")!;
    expect(tmux.check()).toEqual({ ok: false, info: "not found" });
  });
});

describe("cmdDoctor", () => {
  it("reports success when everything is installed", () => {
    const log = captureLog();

    cmdDoctor();

    expect(log.output()).toContain("✅ All dependencies ready!");
    expect(log.output()).not.toContain("❌");
  });

  it("shows install instructions when a dependency is missing", () => {
    vi.mocked(run).mockReturnValue({ stdout: "", stderr: "", code: null });
    const log = captureLog();

    cmdDoctor();

    const out = log.output();
    expect(out).toContain("❌");
    expect(out).toContain("Some dependencies are not installed");
    expect(out).toContain("@anthropic-ai/claude-code");
  });
});
