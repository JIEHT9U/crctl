import { describe, expect, it } from "vitest";
import {
  detectShell,
  dirHash,
  extractLink,
  sessionName,
  sleep,
} from "../src/utils";

describe("dirHash", () => {
  it("returns an 8-character hex hash", () => {
    const hash = dirHash("/home/user/project");
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is stable for the same directory", () => {
    expect(dirHash("/a/b/c")).toBe(dirHash("/a/b/c"));
  });

  it("differs for different directories", () => {
    expect(dirHash("/a/b/c")).not.toBe(dirHash("/a/b/d"));
  });
});

describe("sessionName", () => {
  it("prefixes the hash with claude-rc-", () => {
    const name = sessionName("/home/user/project");
    expect(name).toBe(`claude-rc-${dirHash("/home/user/project")}`);
    expect(name).toMatch(/^claude-rc-[0-9a-f]{8}$/);
  });
});

describe("extractLink", () => {
  it("extracts the claude.ai link from pane output", () => {
    const content = [
      "Starting Claude Code...",
      "Open in your browser:",
      "  https://claude.ai/code?environment=abc123_XYZ",
      "Press Space for QR code",
    ].join("\n");
    expect(extractLink(content)).toBe(
      "https://claude.ai/code?environment=abc123_XYZ"
    );
  });

  it("supports hyphens in the environment id", () => {
    expect(
      extractLink("https://claude.ai/code?environment=ab-12_cd")
    ).toBe("https://claude.ai/code?environment=ab-12_cd");
  });

  it("returns the first link when several are present", () => {
    const content =
      "https://claude.ai/code?environment=first\nhttps://claude.ai/code?environment=second";
    expect(extractLink(content)).toBe(
      "https://claude.ai/code?environment=first"
    );
  });

  it("returns null when no link is present", () => {
    expect(extractLink("no links here")).toBeNull();
    expect(extractLink("")).toBeNull();
    expect(extractLink("https://claude.ai/code")).toBeNull();
  });
});

describe("sleep", () => {
  it("blocks for at least the requested duration", () => {
    const start = Date.now();
    sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(45);
  });
});

describe("detectShell", () => {
  it("detects fish", () => {
    expect(detectShell("/usr/bin/fish")).toBe("fish");
  });

  it("detects zsh", () => {
    expect(detectShell("/bin/zsh")).toBe("zsh");
  });

  it("falls back to bash", () => {
    expect(detectShell("/bin/bash")).toBe("bash");
    expect(detectShell("/bin/sh")).toBe("bash");
    expect(detectShell("")).toBe("bash");
  });
});
