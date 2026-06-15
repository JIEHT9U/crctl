import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
  writeFileSync: vi.fn(),
}));
vi.mock("../src/tmux", () => ({ run: vi.fn() }));

import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { SYSTEMD_UNIT_NAME, SYSTEMD_UNIT_PATH } from "../src/constants";
import {
  installService,
  serviceInstalled,
  uninstallService,
} from "../src/service";
import { run } from "../src/tmux";

/** Force a platform for the duration of a test (restored in afterEach). */
const realPlatform = process.platform;
function setPlatform(p: NodeJS.Platform) {
  Object.defineProperty(process, "platform", { value: p, configurable: true });
}

beforeEach(() => {
  vi.resetAllMocks();
  setPlatform("linux");
  vi.mocked(run).mockReturnValue({ stdout: "", stderr: "", code: 0 });
});

afterEach(() => {
  setPlatform(realPlatform);
});

describe("installService (systemd)", () => {
  it("writes the unit and enables it via systemctl --user", () => {
    const result = installService();

    expect(writeFileSync).toHaveBeenCalledWith(
      SYSTEMD_UNIT_PATH,
      expect.stringContaining("ExecStart=")
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      SYSTEMD_UNIT_PATH,
      expect.stringContaining(" restore\n")
    );
    expect(run).toHaveBeenCalledWith("systemctl", ["--user", "daemon-reload"]);
    expect(run).toHaveBeenCalledWith("systemctl", [
      "--user",
      "enable",
      SYSTEMD_UNIT_NAME,
    ]);
    expect(result.ok).toBe(true);
  });

  it("reports failure when systemctl enable fails", () => {
    vi.mocked(run).mockImplementation((_cmd, args) =>
      args.includes("enable")
        ? { stdout: "", stderr: "Failed to connect to bus", code: 1 }
        : { stdout: "", stderr: "", code: 0 }
    );

    const result = installService();

    expect(result.ok).toBe(false);
    expect(result.steps.join("\n")).toContain("Failed to enable");
    expect(result.steps.join("\n")).toContain("Failed to connect to bus");
  });
});

describe("uninstallService (systemd)", () => {
  it("disables and removes the unit when it exists", () => {
    vi.mocked(existsSync).mockReturnValue(true);

    const result = uninstallService();

    expect(run).toHaveBeenCalledWith("systemctl", [
      "--user",
      "disable",
      SYSTEMD_UNIT_NAME,
    ]);
    expect(unlinkSync).toHaveBeenCalledWith(SYSTEMD_UNIT_PATH);
    expect(result.steps.join("\n")).toContain("Removed unit");
  });

  it("is a no-op when nothing is installed", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = uninstallService();

    expect(unlinkSync).not.toHaveBeenCalled();
    expect(result.steps.join("\n")).toContain("No service installed");
  });
});

describe("serviceInstalled", () => {
  it("reflects whether the unit file exists", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(serviceInstalled()).toBe(true);
    vi.mocked(existsSync).mockReturnValue(false);
    expect(serviceInstalled()).toBe(false);
  });

  it("returns false on unsupported platforms", () => {
    setPlatform("freebsd" as NodeJS.Platform);
    expect(serviceInstalled()).toBe(false);
  });
});
