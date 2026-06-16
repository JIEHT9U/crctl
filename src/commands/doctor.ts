import { DISABLE_TRAFFIC_ENV } from "../constants";
import { run } from "../tmux";
import type { DoctorCheck } from "../types";

export function buildChecks(): DoctorCheck[] {
  return [
    {
      name: "Node.js",
      check: () => ({ ok: true, info: process.version }),
    },
    {
      name: "tmux",
      check: () => {
        const result = run("tmux", ["-V"]);
        return {
          ok: result.code === 0,
          info: result.stdout || "not found",
        };
      },
    },
    {
      name: "claude",
      check: () => {
        const result = run("claude", ["--version"]);
        return {
          ok: result.code === 0,
          info: result.stdout || result.stderr || "not found",
        };
      },
    },
    {
      name: "Remote Control",
      check: () =>
        process.env[DISABLE_TRAFFIC_ENV]
          ? {
              ok: true,
              info: `⚠️  ${DISABLE_TRAFFIC_ENV} is set — crctl strips it on launch (plain \`claude remote-control\` won't start)`,
            }
          : { ok: true, info: "ready" },
    },
    {
      name: "Shell",
      check: () => ({ ok: true, info: process.env.SHELL || "unknown" }),
    },
    {
      name: "Platform",
      check: () => {
        const platform =
          process.platform === "darwin" ? "macOS" : process.platform;
        return { ok: true, info: `${platform} ${process.arch}` };
      },
    },
  ];
}

export function cmdDoctor(): void {
  console.log("🩺 Checking crctl dependencies:\n");

  let allOk = true;
  for (const c of buildChecks()) {
    const { ok, info } = c.check();
    const icon = ok ? "✅" : "❌";
    console.log(`  ${icon} ${c.name.padEnd(12)} ${info}`);
    if (!ok) allOk = false;
  }

  console.log("");
  if (allOk) {
    console.log("✅ All dependencies ready!");
    return;
  }

  console.log("⚠️  Some dependencies are not installed.");
  console.log("");
  if (process.platform === "darwin") {
    console.log("🍎 Install on macOS:");
    console.log("  brew install node");
    console.log("  brew install tmux");
    console.log("  npm install -g @anthropic-ai/claude-code");
  } else {
    console.log("🐧 Install on Linux:");
    console.log("  # Node.js: nvm install --lts or from a repository package");
    console.log("  sudo dnf install tmux");
    console.log("  npm install -g @anthropic-ai/claude-code");
  }
}
