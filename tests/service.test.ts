import { describe, expect, it } from "vitest";
import {
  launchdPlistText,
  servicePath,
  systemdUnitText,
} from "../src/service";

const NODE = "/usr/bin/node";
const SCRIPT = "/home/user/.local/bin/crctl";

describe("servicePath", () => {
  it("includes the dirs holding node, crctl and tmux", () => {
    const path = servicePath(NODE, SCRIPT);
    expect(path).toContain("/usr/bin"); // node + tmux
    expect(path).toContain("/home/user/.local/bin"); // crctl
  });

  it("does not repeat duplicate directories", () => {
    const path = servicePath("/usr/bin/node", "/usr/bin/crctl");
    const occurrences = path.split(":").filter((p) => p === "/usr/bin").length;
    expect(occurrences).toBe(1);
  });
});

describe("systemdUnitText", () => {
  const unit = systemdUnitText(NODE, SCRIPT);

  it("runs `crctl restore` as a oneshot on login", () => {
    expect(unit).toContain("Type=oneshot");
    expect(unit).toContain(`ExecStart=${NODE} ${SCRIPT} restore`);
    expect(unit).toContain("WantedBy=default.target");
  });

  it("bakes in an explicit PATH for the minimal login environment", () => {
    expect(unit).toContain("Environment=PATH=");
  });
});

describe("launchdPlistText", () => {
  const plist = launchdPlistText(NODE, SCRIPT);

  it("is a valid-looking LaunchAgent that runs at load", () => {
    expect(plist).toContain("<plist version=\"1.0\">");
    expect(plist).toContain("com.crctl.restore");
    expect(plist).toContain("<key>RunAtLoad</key>");
    expect(plist).toContain("<true/>");
  });

  it("invokes node, the crctl script and the restore subcommand in order", () => {
    const argsBlock = plist.slice(
      plist.indexOf("<key>ProgramArguments</key>"),
      plist.indexOf("</array>")
    );
    expect(argsBlock.indexOf(NODE)).toBeLessThan(argsBlock.indexOf(SCRIPT));
    expect(argsBlock.indexOf(SCRIPT)).toBeLessThan(argsBlock.indexOf("restore"));
  });
});
