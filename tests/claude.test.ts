import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  ensureRemoteControlEnabled,
  hasTrafficFlag,
  isDirectoryTrusted,
  trustDirectory,
  withoutTrafficFlag,
  withTrustedDirectory,
} from "../src/claude";

const CWD = "/home/user/project";
const OTHER = "/home/user/other";
const FLAG = "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("withTrustedDirectory", () => {
  it("scaffolds a new project entry marked trusted", () => {
    const next = withTrustedDirectory({}, CWD) as any;
    expect(next.projects[CWD].hasTrustDialogAccepted).toBe(true);
  });

  it("preserves an existing entry's other fields", () => {
    const config = {
      projects: { [CWD]: { hasTrustDialogAccepted: false, allowedTools: ["Bash"] } },
    };
    const next = withTrustedDirectory(config, CWD) as any;
    expect(next.projects[CWD].hasTrustDialogAccepted).toBe(true);
    expect(next.projects[CWD].allowedTools).toEqual(["Bash"]);
  });

  it("never touches other projects or top-level keys", () => {
    const config = {
      numStartups: 7,
      projects: { [OTHER]: { hasTrustDialogAccepted: true, foo: 1 } },
    };
    const next = withTrustedDirectory(config, CWD) as any;
    expect(next.numStartups).toBe(7);
    expect(next.projects[OTHER]).toEqual({ hasTrustDialogAccepted: true, foo: 1 });
    expect(next.projects[CWD].hasTrustDialogAccepted).toBe(true);
  });
});

describe("isDirectoryTrusted", () => {
  it("is true only when the flag is explicitly true", () => {
    expect(isDirectoryTrusted({ projects: { [CWD]: { hasTrustDialogAccepted: true } } }, CWD)).toBe(true);
    expect(isDirectoryTrusted({ projects: { [CWD]: { hasTrustDialogAccepted: false } } }, CWD)).toBe(false);
    expect(isDirectoryTrusted({ projects: {} }, CWD)).toBe(false);
    expect(isDirectoryTrusted({}, CWD)).toBe(false);
    expect(isDirectoryTrusted(null, CWD)).toBe(false);
  });
});

describe("trustDirectory", () => {
  it("writes a trusted entry when the config file is missing", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    expect(trustDirectory(CWD, "/tmp/claude.json")).toBe(true);
    expect(writeFileSync).toHaveBeenCalledTimes(1);
    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
    expect(written.projects[CWD].hasTrustDialogAccepted).toBe(true);
  });

  it("merges into an existing config without losing data", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ numStartups: 3, projects: { [OTHER]: { hasTrustDialogAccepted: true } } })
    );

    trustDirectory(CWD, "/tmp/claude.json");

    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
    expect(written.numStartups).toBe(3);
    expect(written.projects[OTHER].hasTrustDialogAccepted).toBe(true);
    expect(written.projects[CWD].hasTrustDialogAccepted).toBe(true);
  });

  it("skips the write when the directory is already trusted", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ projects: { [CWD]: { hasTrustDialogAccepted: true } } })
    );

    expect(trustDirectory(CWD, "/tmp/claude.json")).toBe(true);
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it("is best-effort: returns false (does not throw) on malformed JSON", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("{ not json");

    expect(trustDirectory(CWD, "/tmp/claude.json")).toBe(false);
    expect(writeFileSync).not.toHaveBeenCalled();
  });
});

describe("hasTrafficFlag", () => {
  it("detects the kill-switch only inside env", () => {
    expect(hasTrafficFlag({ env: { [FLAG]: "1" } })).toBe(true);
    expect(hasTrafficFlag({ env: { [FLAG]: "" } })).toBe(true); // present counts
    expect(hasTrafficFlag({ env: { FOO: "bar" } })).toBe(false);
    expect(hasTrafficFlag({ [FLAG]: "1" })).toBe(false); // not inside env
    expect(hasTrafficFlag({})).toBe(false);
    expect(hasTrafficFlag(null)).toBe(false);
  });
});

describe("withoutTrafficFlag", () => {
  it("removes the kill-switch but keeps other env vars and top-level keys", () => {
    const next = withoutTrafficFlag({
      model: "opus",
      env: { [FLAG]: "1", FOO: "bar" },
    }) as any;
    expect(next.env).toEqual({ FOO: "bar" });
    expect(next.model).toBe("opus");
  });

  it("returns the config untouched when the flag is absent", () => {
    const config = { env: { FOO: "bar" } };
    expect(withoutTrafficFlag(config)).toBe(config);
  });
});

describe("ensureRemoteControlEnabled", () => {
  it("strips the flag and rewrites the file, preserving everything else", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ env: { [FLAG]: "1" }, model: "opus" })
    );

    expect(ensureRemoteControlEnabled("/tmp/settings.json")).toBe(true);
    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string);
    expect(written).toEqual({ env: {}, model: "opus" });
  });

  it("does not write when the flag is absent", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ env: { FOO: "bar" } }));

    expect(ensureRemoteControlEnabled("/tmp/settings.json")).toBe(false);
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it("does nothing when the settings file is missing", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    expect(ensureRemoteControlEnabled("/tmp/settings.json")).toBe(false);
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it("is best-effort: returns false (does not throw) on malformed JSON", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("{ not json");

    expect(ensureRemoteControlEnabled("/tmp/settings.json")).toBe(false);
    expect(writeFileSync).not.toHaveBeenCalled();
  });
});
