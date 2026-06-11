import { Command } from "commander";
import { execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

const VERSION = __VERSION__; // Injected by tsup

// ─── Constants ──────────────────────────────────────────────

const SESSION_PREFIX = "claude-rc";
const CONFIG_DIR =
  process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support", "crctl")
    : join(homedir(), ".config", "crctl");
const SESSIONS_FILE = join(CONFIG_DIR, "sessions.json");

// ─── Session Registry ──────────────────────────────────────

interface SessionEntry {
  name: string;
  cwd: string;
  pids: number[];
  link?: string;
}

interface SessionsData {
  sessions: Record<string, SessionEntry>;
}

function loadSessions(): SessionsData {
  if (existsSync(SESSIONS_FILE)) {
    try {
      return JSON.parse(readFileSync(SESSIONS_FILE, "utf8"));
    } catch {
      return { sessions: {} };
    }
  }
  return { sessions: {} };
}

function saveSessions(data: SessionsData): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
}

// ─── Helpers ────────────────────────────────────────────────

function dirHash(dir: string): string {
  return createHash("md5").update(dir).digest("hex").slice(0, 8);
}

function sessionName(dir: string): string {
  return `${SESSION_PREFIX}-${dirHash(dir)}`;
}

function run(
  cmd: string,
  args: string[]
): { stdout: string; stderr: string; code: number | null } {
  const result = spawnSync(cmd, args, { encoding: "utf8", timeout: 10000 });
  return {
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
    code: result.status ?? null,
  };
}

function sessionExists(name: string): boolean {
  const result = run("tmux", ["has-session", "-t", name]);
  return result.code === 0;
}

function getPaneContent(name: string): string {
  try {
    const result = run("tmux", [
      "capture-pane",
      "-t",
      name,
      "-p",
      "-S",
      "-50",
      "-J",
    ]);
    return result.stdout.replace(/\r/g, "");
  } catch {
    return "";
  }
}

function extractLink(content: string): string | null {
  const match = content.match(
    /https:\/\/claude\.ai\/code\?environment=[a-zA-Z0-9_]+/
  );
  return match ? match[0] : null;
}

// Cross-platform: find claude remote-control processes
function findClaudeProcesses(): number[] {
  try {
    const output = execSync("ps aux", { encoding: "utf8" });
    const pids: number[] = [];
    for (const line of output.split("\n")) {
      if (line.includes("claude") && line.includes("remote-control")) {
        const pid = parseInt(line.trim().split(/\s+/)[1], 10);
        if (!isNaN(pid) && pid !== process.pid) {
          pids.push(pid);
        }
      }
    }
    return pids;
  } catch {
    return [];
  }
}

function killPids(pids: number[]): void {
  for (const pid of pids) {
    try {
      process.kill(pid, 9);
    } catch {
      // Process already gone
    }
  }
}

// ─── Commands ───────────────────────────────────────────────

function cmdStart() {
  const cwd = process.cwd();
  const name = sessionName(cwd);

  if (sessionExists(name)) {
    console.log(`⚠️  Session already active for ${cwd}`);
    console.log(`   Connect via: crctl attach`);
    process.exit(0);
  }

  console.log(`🚀 Starting Claude Code (remote-control)...`);
  console.log(`   Directory: ${cwd}`);

  run("tmux", [
    "new-session",
    "-d",
    "-s",
    name,
    "-c",
    cwd,
    "claude",
    "remote-control",
  ]);

  // Wait for the link to appear (up to 15 seconds)
  let link: string | null = null;
  for (let i = 0; i < 30; i++) {
    spawnSync("sleep", ["0.5"]);
    const content = getPaneContent(name);
    link = extractLink(content);
    if (link) break;
  }

  // Save to registry
  const data = loadSessions();
  data.sessions[cwd] = { name, cwd, pids: [], link };
  saveSessions(data);

  console.log("");
  if (link) {
    console.log("✅ Done!");
    console.log("");
    console.log(`🔗 Browser link:`);
    console.log(`   ${link}`);
    console.log("");
    console.log("📱 Press Space inside the session for a QR code:");
    console.log(`   crctl attach`);
  } else {
    console.log("⚠️  Failed to get the link automatically.");
    console.log("   Connect to the session manually:");
    console.log(`   crctl attach`);
  }
}

function cmdStop(options: { global: boolean }) {
  const data = loadSessions();

  if (options.global) {
    // Stop ALL sessions
    const targets = Object.values(data.sessions).filter((s) =>
      sessionExists(s.name)
    );

    if (targets.length === 0) {
      console.log("ℹ️  No active sessions.");
      return;
    }

    console.log(`🛑 Stopping all sessions (${targets.length})...`);
    for (const s of targets) {
      console.log(`   📂 ${s.cwd}`);
      run("tmux", ["kill-session", "-t", s.name]);
      delete data.sessions[s.cwd];
    }

    spawnSync("sleep", ["1"]);
    const pids = findClaudeProcesses();
    if (pids.length > 0) {
      console.log(`   Killing orphaned processes: ${pids.join(" ")}`);
      killPids(pids);
    }

    saveSessions(data);
    console.log("✅ All sessions stopped.");
    return;
  }

  // Current directory
  const cwd = process.cwd();
  const name = sessionName(cwd);
  let stopped = false;

  if (sessionExists(name)) {
    console.log(`🛑 Stopping session for ${cwd}...`);
    run("tmux", ["kill-session", "-t", name]);
    stopped = true;
    delete data.sessions[cwd];

    spawnSync("sleep", ["1"]);
  }

  // Clean up orphaned processes
  const pids = findClaudeProcesses();
  if (pids.length > 0) {
    console.log(`   Killing orphaned processes: ${pids.join(" ")}`);
    killPids(pids);
  }

  saveSessions(data);

  if (stopped) {
    console.log("✅ Session and all processes terminated.");
  } else if (pids.length > 0) {
    console.log("✅ Processes terminated.");
  } else {
    console.log("ℹ️  Session not found. All clean.");
  }
}

function cmdStatus(options: { global: boolean }) {
  if (options.global) {
    const data = loadSessions();
    const sessions = Object.values(data.sessions).filter((s) =>
      sessionExists(s.name)
    );

    if (sessions.length === 0) {
      // Check via tmux in case the registry is empty
      const result = run("tmux", [
        "list-sessions",
        "-F",
        "#{session_name} #{pane_current_path}",
      ]);
      const tmuxSessions = (result.stdout || "")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(/\s+(\/.*)$/, 2);
          return { name: parts[0], path: parts[1] || "unknown" };
        })
        .filter((s) => s.name.startsWith(SESSION_PREFIX + "-"));

      if (tmuxSessions.length === 0) {
        console.log("No active crctl sessions");
        return;
      }

      console.log("🌍 Active crctl sessions:");
      console.log("");

      for (const s of tmuxSessions) {
        const pidResult = run("tmux", [
          "list-panes",
          "-t",
          s.name,
          "-F",
          "#{pane_pid}",
        ]);
        const pid = pidResult.stdout || "—";

        console.log(`  📂 ${s.path}`);
        console.log(`     Session: ${s.name}`);
        console.log(`     PID: ${pid}`);
        console.log("");
      }
      return;
    }

    console.log("🌍 Active crctl sessions:");
    console.log("");

    for (const s of sessions) {
      const pidResult = run("tmux", [
        "list-panes",
        "-t",
        s.name,
        "-F",
        "#{pane_pid}",
      ]);
      const pid = pidResult.stdout || "—";

      console.log(`  📂 ${s.cwd}`);
      console.log(`     Session: ${s.name}`);
      console.log(`     PID: ${pid}`);
      if (s.link) {
        console.log(`     🔗 ${s.link}`);
      }
      console.log("");
    }
    return;
  }

  // Normal mode — current directory
  const cwd = process.cwd();
  const name = sessionName(cwd);

  const active = sessionExists(name);
  const pids = findClaudeProcesses();
  const data = loadSessions();
  const entry = data.sessions[cwd];

  if (active) {
    console.log(`✅ Session active for ${cwd}`);
    console.log(`   Session: ${name}`);
    if (entry?.link) {
      console.log(`   🔗 ${entry.link}`);
    }
    if (pids.length > 0) {
      console.log(`   PID: ${pids.join(" ")}`);
    }
  } else {
    console.log(`❌ Session not running for ${cwd}`);
    if (pids.length > 0) {
      console.log(`⚠️  But there are orphaned processes: ${pids.join(" ")}`);
      console.log("   Run: crctl stop");
    }
  }
}

function cmdAttach() {
  const cwd = process.cwd();
  const name = sessionName(cwd);

  if (!sessionExists(name)) {
    console.log(`❌ No active session for ${cwd}`);
    console.log("   Run: crctl start");
    process.exit(1);
  }

  run("tmux", ["attach-session", "-t", name]);
}

function cmdLink() {
  const cwd = process.cwd();
  const name = sessionName(cwd);

  // First look in the registry
  const data = loadSessions();
  const entry = data.sessions[cwd];
  if (entry?.link) {
    console.log(entry.link);
    return;
  }

  // If not in registry — look in tmux
  if (sessionExists(name)) {
    const content = getPaneContent(name);
    const link = extractLink(content);
    if (link) {
      console.log(link);
      entry.link = link;
      saveSessions(data);
      return;
    }
  }

  console.log("❌ Link not found");
  process.exit(1);
}

// ─── Doctor ─────────────────────────────────────────────────

function cmdDoctor() {
  const checks: { name: string; check: () => { ok: boolean; info: string } }[] =
    [
      {
        name: "Node.js",
        check: () => {
          const version = execSync("node --version", {
            encoding: "utf8",
          }).trim();
          return { ok: true, info: version };
        },
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
        name: "Shell",
        check: () => {
          const shell = process.env.SHELL || "unknown";
          return { ok: true, info: shell };
        },
      },
      {
        name: "Platform",
        check: () => {
          const platform = process.platform === "darwin" ? "macOS" : process.platform;
          return { ok: true, info: `${platform} ${process.arch}` };
        },
      },
    ];

  console.log("🩺 Checking crctl dependencies:\n");

  let allOk = true;
  for (const c of checks) {
    const { ok, info } = c.check();
    const icon = ok ? "✅" : "❌";
    console.log(`  ${icon} ${c.name.padEnd(12)} ${info}`);
    if (!ok) allOk = false;
  }

  console.log("");
  if (!allOk) {
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
  } else {
    console.log("✅ All dependencies ready!");
  }
}

// ─── Completions ────────────────────────────────────────────

const FISH_COMPLETION = `
# crctl — fish completion

# Helper: get current subcommand from commandline
function __fish_crctl_current_sub
    set -l tokens (commandline -ct)
    for tok in $tokens
        switch $tok
            case '-*' '*=*'
                continue
            case '*'
                echo $tok
                return
        end
    end
end

complete -c crctl -f -n '__fish_use_subcommand' -a 'start' -d 'Start Claude Code in remote-control mode'
complete -c crctl -f -n '__fish_use_subcommand' -a 'stop' -d 'Stop Claude Code session'
complete -c crctl -f -n '__fish_use_subcommand' -a 'status' -d 'Show Claude Code session status'
complete -c crctl -f -n '__fish_use_subcommand' -a 'attach' -d 'Attach to tmux session'
complete -c crctl -f -n '__fish_use_subcommand' -a 'link' -d 'Print browser link'
complete -c crctl -f -n '__fish_use_subcommand' -a 'doctor' -d 'Check dependencies'
complete -c crctl -f -n '__fish_use_subcommand' -a 'setup' -d 'Install shell completions'
complete -c crctl -f -n '__fish_use_subcommand' -a 'generate' -d 'Generate completion script'
complete -c crctl -f -n '__fish_use_subcommand' -a 'update' -d 'Check for updates and upgrade'
complete -c crctl -f -n '__fish_use_subcommand' -a 'uninstall' -d 'Remove crctl and clean up'
complete -c crctl -f -s V -l version -d 'Version'
complete -c crctl -f -s h -l help -d 'Help'
complete -c crctl -f -s g -l global -d 'Apply to all sessions'
complete -c crctl -n 'string match -q "generate" (__fish_crctl_current_sub)' -f -a 'bash fish zsh' -d 'Shell type'
`;

const BASH_COMPLETION = `
# crctl — bash completion
_crctl() {
    local cur prev cmds
    cmds="start stop status attach link doctor setup generate update uninstall"
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"

    case \$prev in
        crctl)
            COMPREPLY=( \$(compgen -W "\${cmds}" -- "\${cur}") )
            ;;
        generate)
            COMPREPLY=( \$(compgen -W "bash fish zsh" -- "\${cur}") )
            ;;
        stop|status)
            COMPREPLY=( \$(compgen -W "-g --global" -- "\${cur}") )
            ;;
        *)
            COMPREPLY=( \$(compgen -W "-h --help -V --version" -- "\${cur}") )
            ;;
    esac
}
complete -F _crctl crctl
`;

const ZSH_COMPLETION = `
# crctl — zsh completion
#compdef crctl

_crctl() {
    local commands
    commands=(
        'start:Start Claude Code in remote-control mode'
        'stop:Stop Claude Code session'
        'status:Show Claude Code session status'
        'attach:Attach to tmux session'
        'link:Print browser link'
        'doctor:Check dependencies'
        'setup:Install shell completions'
        'generate:Generate completion script'
        'update:Check for updates and upgrade'
        'uninstall:Remove crctl and clean up'
    )

    _arguments -C \
        '(- *){-V,--version}' \
        '(- *){-h,--help}' \
        '1: :->cmds' \
        '*::arg:->args' && return 0

    case \$state in
        cmds)
            _describe 'command' commands ;;
        args)
            case \$words[1] in
                stop|status)
                    _arguments '(-g,--global)' \
                        '(-g --global){-g,--global}[Stop/Show ALL sessions]' ;;
                generate)
                    _arguments '1:shell:(bash fish zsh)' ;;
            esac ;;
    esac
}

_crctl "\@"
`;

function cmdGenerate(shell: string) {
  switch (shell) {
    case "fish":
      console.log(FISH_COMPLETION.trim());
      break;
    case "bash":
      console.log(BASH_COMPLETION.trim());
      break;
    case "zsh":
      console.log(ZSH_COMPLETION.trim());
      break;
    default:
      console.log(`❌ Unknown shell: ${shell}`);
      console.log("   Supported: bash, fish, zsh");
      process.exit(1);
  }
}

function cmdSetup() {
  const shell = process.env.SHELL || "";
  let shellName: string;

  if (shell.includes("fish")) {
    shellName = "fish";
  } else if (shell.includes("zsh")) {
    shellName = "zsh";
  } else {
    shellName = "bash";
  }

  console.log(`🐚 Detected shell: ${shellName} (${shell})`);

  const scripts: Record<string, string> = {
    fish: FISH_COMPLETION.trim(),
    bash: BASH_COMPLETION.trim(),
    zsh: ZSH_COMPLETION.trim(),
  };
  const compScript = scripts[shellName];

  if (shellName === "fish") {
    const completionsDir = join(homedir(), ".config", "fish", "completions");
    const targetPath = join(completionsDir, "crctl.fish");

    try {
      mkdirSync(completionsDir, { recursive: true });
      writeFileSync(targetPath, compScript);
      console.log(`✅ Auto-completion installed: ${targetPath}`);
      console.log("");
      console.log("   Restart your terminal or run:");
      console.log(`   fish_update_completions`);
    } catch (err: any) {
      console.log("❌ Failed to install automatically.");
      console.log("");
      console.log("   Install manually:");
      console.log(`   mkdir -p ${completionsDir}`);
      console.log(`   crctl generate fish > ${targetPath}`);
    }
  } else if (shellName === "bash") {
    const targetPath = join(homedir(), ".bash_completion_crctl");

    try {
      writeFileSync(targetPath, compScript);
      console.log(`✅ Auto-completion script: ${targetPath}`);
      console.log("");
      console.log("   Add to ~/.bashrc:");
      console.log(`   source ${targetPath}`);
    } catch (err: any) {
      console.log("❌ Failed to install.");
      console.log("");
      console.log("   Install manually:");
      console.log(`   crctl generate bash > ${targetPath}`);
      console.log(`   echo 'source ${targetPath}' >> ~/.bashrc`);
    }
  } else if (shellName === "zsh") {
    const zshDir = join(homedir(), ".oh-my-zsh", "custom", "plugins", "crctl");
    const targetPath = join(zshDir, "_crctl");

    try {
      mkdirSync(zshDir, { recursive: true });
      writeFileSync(targetPath, compScript);
      console.log(`✅ Auto-completion script: ${targetPath}`);
      console.log("");
      console.log("   Add 'crctl' to plugins in ~/.zshrc");
    } catch (err: any) {
      console.log("❌ Failed to install.");
      console.log("");
      console.log("   Install manually:");
      console.log(`   crctl generate zsh > /usr/local/share/zsh/site-functions/_crctl`);
    }
  }
}

// ─── Update & Uninstall ─────────────────────────────────────

function cmdUpdate() {
  console.log("🔄 Checking for updates...");
  try {
    const output = execSync("curl -s https://api.github.com/repos/JIEHT9U/crctl/releases/latest", {
      encoding: "utf8",
    });
    const latest = JSON.parse(output);
    const latestVersion = latest.tag_name.replace("v", "");

    if (latestVersion === VERSION) {
      console.log(`✅ crctl is already up to date (${VERSION}).`);
      return;
    }

    console.log(`🚀 New version available: ${latestVersion} (you have ${VERSION})`);
    console.log("   Updating...");

    const result = spawnSync("sh", ["-c", "curl -fsSL https://raw.githubusercontent.com/JIEHT9U/crctl/main/install.sh | sh"], {
      stdio: "inherit",
    });

    if (result.status === 0) {
      console.log(`✅ Updated to ${latestVersion}!`);
    } else {
      console.log("❌ Update failed.");
      process.exit(1);
    }
  } catch (err: any) {
    console.log("❌ Failed to check for updates.");
    console.log(`   Error: ${err.message}`);
    process.exit(1);
  }
}

function cmdUninstall() {
  const binaryPath = process.argv[1];
  const shell = process.env.SHELL || "";
  let shellName = "unknown";

  if (shell.includes("fish")) shellName = "fish";
  else if (shell.includes("zsh")) shellName = "zsh";
  else shellName = "bash";

  console.log("🗑️  Uninstalling crctl...");

  // 1. Remove binary
  try {
    unlinkSync(binaryPath);
    console.log(`✅ Binary removed: ${binaryPath}`);
  } catch {
    console.log(`⚠️  Could not remove binary: ${binaryPath}`);
  }

  // 2. Remove PATH lines from shell config
  const configs: Record<string, string> = {
    fish: join(homedir(), ".config", "fish", "config.fish"),
    bash: join(homedir(), ".bashrc"),
    zsh: join(homedir(), ".zshrc"),
  };

  const configPath = configs[shellName];
  if (configPath && existsSync(configPath)) {
    try {
      let content = readFileSync(configPath, "utf8");
      const originalLines = content.split("\n");
      const cleanedLines = originalLines.filter(
        (line) => !line.includes("crctl") && !line.includes("crctl")
      );

      if (cleanedLines.length < originalLines.length) {
        writeFileSync(configPath, cleanedLines.join("\n"));
        console.log(`✅ Cleaned crctl entries from ${configPath}`);
      }
    } catch {
      console.log(`⚠️  Could not clean ${configPath}`);
    }
  }

  // 3. Remove completions
  const completionPaths = [
    join(homedir(), ".config", "fish", "completions", "crctl.fish"),
    join(homedir(), ".bash_completion_crctl"),
  ];

  for (const path of completionPaths) {
    if (existsSync(path)) {
      try {
        unlinkSync(path);
        console.log(`✅ Removed completion: ${path}`);
      } catch {}
    }
  }

  console.log("");
  console.log("👋 crctl has been removed. You may need to restart your terminal.");
}

// ─── CLI ────────────────────────────────────────────────────

const program = new Command();

program
  .name("crctl")
  .description("Claude Remote Control — manage Claude Code sessions via tmux")
  .version(VERSION);

program
  .command("start")
  .description("Start Claude Code in remote-control mode (current directory)")
  .action(cmdStart);

program
  .command("stop")
  .description("Stop Claude Code session (current directory)")
  .option("-g, --global", "Stop ALL sessions in all directories")
  .action(cmdStop);

program
  .command("status")
  .description("Show Claude Code session status")
  .option("-g, --global", "Show all sessions in all directories")
  .action((opts: { global?: boolean }) => cmdStatus({ global: !!opts.global }));

program
  .command("attach")
  .description("Attach to the current directory's tmux session")
  .action(cmdAttach);

program
  .command("link")
  .description("Print the browser link for the current directory's session")
  .action(cmdLink);

program
  .command("doctor")
  .description("Check all dependencies and show install instructions")
  .action(cmdDoctor);

program
  .command("generate")
  .description("Generate shell completion script (bash|fish|zsh)")
  .argument("<shell>", "Shell type: bash, fish, or zsh")
  .action(cmdGenerate);

program
  .command("setup")
  .description(
    "Auto-detect your shell and install completions"
  )
  .action(cmdSetup);

program
  .command("update")
  .description("Check for updates and upgrade to the latest version")
  .action(cmdUpdate);

program
  .command("uninstall")
  .description("Remove crctl and clean up shell configurations")
  .action(cmdUninstall);

program.parse();
