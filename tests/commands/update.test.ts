import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
}));

import { execSync, spawnSync } from "node:child_process";
import { cmdUpdate } from "../../src/commands/update";
import { captureLog, trapExit } from "../helpers";

const mockExecSync = vi.mocked(execSync);
const mockSpawnSync = vi.mocked(spawnSync);

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  mockSpawnSync.mockReturnValue({ status: 0 } as any);
});

describe("cmdUpdate", () => {
  it("reports up to date when versions match", () => {
    mockExecSync.mockReturnValue(JSON.stringify({ tag_name: "v1.2.3" }) as any);
    const log = captureLog();

    cmdUpdate("1.2.3");

    expect(log.output()).toContain("already up to date (1.2.3)");
    expect(mockSpawnSync).not.toHaveBeenCalled();
  });

  it("runs the installer when a newer version exists", () => {
    mockExecSync.mockReturnValue(JSON.stringify({ tag_name: "v2.0.0" }) as any);
    const log = captureLog();

    cmdUpdate("1.2.3");

    expect(log.output()).toContain("New version available: 2.0.0");
    expect(mockSpawnSync).toHaveBeenCalledWith(
      "sh",
      ["-c", expect.stringContaining("install.sh")],
      { stdio: "inherit" }
    );
    expect(log.output()).toContain("✅ Updated to 2.0.0!");
  });

  it("exits 1 when the installer fails", () => {
    mockExecSync.mockReturnValue(JSON.stringify({ tag_name: "v2.0.0" }) as any);
    mockSpawnSync.mockReturnValue({ status: 1 } as any);
    const log = captureLog();
    trapExit();

    expect(() => cmdUpdate("1.2.3")).toThrow("process.exit(1)");
    expect(log.output()).toContain("Update failed");
  });

  it("exits 1 when the API response has no tag_name (e.g. rate limit)", () => {
    // Regression: this used to throw a raw TypeError on `tag_name.replace`.
    mockExecSync.mockReturnValue(
      JSON.stringify({ message: "API rate limit exceeded" }) as any
    );
    const log = captureLog();
    trapExit();

    expect(() => cmdUpdate("1.2.3")).toThrow("process.exit(1)");
    expect(log.output()).toContain("Could not determine the latest version");
  });

  it("exits 1 when the network request fails", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("curl: (6) Could not resolve host");
    });
    const log = captureLog();
    trapExit();

    expect(() => cmdUpdate("1.2.3")).toThrow("process.exit(1)");
    expect(log.output()).toContain("Failed to check for updates");
  });
});
