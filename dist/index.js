#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";
import { execSync, spawnSync } from "child_process";
import { createHash } from "crypto";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync
} from "fs";
import { join } from "path";
import { homedir } from "os";
var SESSION_PREFIX = "claude-rc";
var CONFIG_DIR = process.platform === "darwin" ? join(homedir(), "Library", "Application Support", "crctl") : join(homedir(), ".config", "crctl");
var SESSIONS_FILE = join(CONFIG_DIR, "sessions.json");
function loadSessions() {
  if (existsSync(SESSIONS_FILE)) {
    try {
      return JSON.parse(readFileSync(SESSIONS_FILE, "utf8"));
    } catch {
      return { sessions: {} };
    }
  }
  return { sessions: {} };
}
function saveSessions(data) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
}
function dirHash(dir) {
  return createHash("md5").update(dir).digest("hex").slice(0, 8);
}
function sessionName(dir) {
  return `${SESSION_PREFIX}-${dirHash(dir)}`;
}
function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8", timeout: 1e4 });
  return {
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
    code: result.status ?? null
  };
}
function sessionExists(name) {
  const result = run("tmux", ["has-session", "-t", name]);
  return result.code === 0;
}
function getPaneContent(name) {
  try {
    const result = run("tmux", [
      "capture-pane",
      "-t",
      name,
      "-p",
      "-S",
      "-50",
      "-J"
    ]);
    return result.stdout.replace(/\r/g, "");
  } catch {
    return "";
  }
}
function extractLink(content) {
  const match = content.match(
    /https:\/\/claude\.ai\/code\?environment=[a-zA-Z0-9_]+/
  );
  return match ? match[0] : null;
}
function findClaudeProcesses() {
  try {
    const output = execSync("ps aux", { encoding: "utf8" });
    const pids = [];
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
function killPids(pids) {
  for (const pid of pids) {
    try {
      process.kill(pid, 9);
    } catch {
    }
  }
}
function cmdStart() {
  const cwd = process.cwd();
  const name = sessionName(cwd);
  if (sessionExists(name)) {
    console.log(`\u26A0\uFE0F  \u0421\u0435\u0441\u0441\u0438\u044F \u0443\u0436\u0435 \u0430\u043A\u0442\u0438\u0432\u043D\u0430 \u0434\u043B\u044F ${cwd}`);
    console.log(`   \u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435\u0441\u044C: crctl attach`);
    process.exit(0);
  }
  console.log(`\u{1F680} \u0417\u0430\u043F\u0443\u0441\u043A Claude Code (remote-control)...`);
  console.log(`   \u0414\u0438\u0440\u0435\u043A\u0442\u043E\u0440\u0438\u044F: ${cwd}`);
  run("tmux", [
    "new-session",
    "-d",
    "-s",
    name,
    "-c",
    cwd,
    "claude",
    "remote-control"
  ]);
  let link = null;
  for (let i = 0; i < 30; i++) {
    spawnSync("sleep", ["0.5"]);
    const content = getPaneContent(name);
    link = extractLink(content);
    if (link) break;
  }
  const data = loadSessions();
  data.sessions[cwd] = { name, cwd, pids: [], link };
  saveSessions(data);
  console.log("");
  if (link) {
    console.log("\u2705 \u0413\u043E\u0442\u043E\u0432\u043E!");
    console.log("");
    console.log(`\u{1F517} \u0421\u0441\u044B\u043B\u043A\u0430 \u0434\u043B\u044F \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430:`);
    console.log(`   ${link}`);
    console.log("");
    console.log("\u{1F4F1} \u041D\u0430\u0436\u043C\u0438 \u041F\u0440\u043E\u0431\u0435\u043B \u0432\u043D\u0443\u0442\u0440\u0438 \u0441\u0435\u0441\u0441\u0438\u0438 \u0434\u043B\u044F QR-\u043A\u043E\u0434\u0430:");
    console.log(`   crctl attach`);
  } else {
    console.log("\u26A0\uFE0F  \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438.");
    console.log("   \u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0441\u044C \u043A \u0441\u0435\u0441\u0441\u0438\u0438 \u0432\u0440\u0443\u0447\u043D\u0443\u044E:");
    console.log(`   crctl attach`);
  }
}
function cmdStop(options) {
  const data = loadSessions();
  if (options.global) {
    const targets = Object.values(data.sessions).filter(
      (s) => sessionExists(s.name)
    );
    if (targets.length === 0) {
      console.log("\u2139\uFE0F  \u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0445 \u0441\u0435\u0441\u0441\u0438\u0439.");
      return;
    }
    console.log(`\u{1F6D1} \u041E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0432\u0441\u0435\u0445 \u0441\u0435\u0441\u0441\u0438\u0439 (${targets.length})...`);
    for (const s of targets) {
      console.log(`   \u{1F4C2} ${s.cwd}`);
      run("tmux", ["kill-session", "-t", s.name]);
      delete data.sessions[s.cwd];
    }
    spawnSync("sleep", ["1"]);
    const pids2 = findClaudeProcesses();
    if (pids2.length > 0) {
      console.log(`   \u0423\u0431\u0438\u0432\u0430\u044E \u0437\u0430\u0432\u0438\u0441\u0448\u0438\u0435 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u044B: ${pids2.join(" ")}`);
      killPids(pids2);
    }
    saveSessions(data);
    console.log("\u2705 \u0412\u0441\u0435 \u0441\u0435\u0441\u0441\u0438\u0438 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B.");
    return;
  }
  const cwd = process.cwd();
  const name = sessionName(cwd);
  let stopped = false;
  if (sessionExists(name)) {
    console.log(`\u{1F6D1} \u041E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0441\u0435\u0441\u0441\u0438\u0438 \u0434\u043B\u044F ${cwd}...`);
    run("tmux", ["kill-session", "-t", name]);
    stopped = true;
    delete data.sessions[cwd];
    spawnSync("sleep", ["1"]);
  }
  const pids = findClaudeProcesses();
  if (pids.length > 0) {
    console.log(`   \u0423\u0431\u0438\u0432\u0430\u044E \u0437\u0430\u0432\u0438\u0441\u0448\u0438\u0435 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u044B: ${pids.join(" ")}`);
    killPids(pids);
  }
  saveSessions(data);
  if (stopped) {
    console.log("\u2705 \u0421\u0435\u0441\u0441\u0438\u044F \u0438 \u0432\u0441\u0435 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u044B \u0443\u0431\u0438\u0442\u044B.");
  } else if (pids.length > 0) {
    console.log("\u2705 \u041F\u0440\u043E\u0446\u0435\u0441\u0441\u044B \u0443\u0431\u0438\u0442\u044B.");
  } else {
    console.log("\u2139\uFE0F  \u0421\u0435\u0441\u0441\u0438\u044F \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430. \u0412\u0441\u0451 \u0447\u0438\u0441\u0442\u043E.");
  }
}
function cmdStatus(options) {
  if (options.global) {
    const data2 = loadSessions();
    const sessions = Object.values(data2.sessions).filter(
      (s) => sessionExists(s.name)
    );
    if (sessions.length === 0) {
      const result = run("tmux", [
        "list-sessions",
        "-F",
        "#{session_name} #{pane_current_path}"
      ]);
      const tmuxSessions = (result.stdout || "").split("\n").filter(Boolean).map((line) => {
        const parts = line.split(/\s+(\/.*)$/, 2);
        return { name: parts[0], path: parts[1] || "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E" };
      }).filter((s) => s.name.startsWith(SESSION_PREFIX + "-"));
      if (tmuxSessions.length === 0) {
        console.log("\u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0445 \u0441\u0435\u0441\u0441\u0438\u0439 crctl");
        return;
      }
      console.log("\u{1F30D} \u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0435 \u0441\u0435\u0441\u0441\u0438\u0438 crctl:");
      console.log("");
      for (const s of tmuxSessions) {
        const pidResult = run("tmux", [
          "list-panes",
          "-t",
          s.name,
          "-F",
          "#{pane_pid}"
        ]);
        const pid = pidResult.stdout || "\u2014";
        console.log(`  \u{1F4C2} ${s.path}`);
        console.log(`     \u0421\u0435\u0441\u0441\u0438\u044F: ${s.name}`);
        console.log(`     PID: ${pid}`);
        console.log("");
      }
      return;
    }
    console.log("\u{1F30D} \u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0435 \u0441\u0435\u0441\u0441\u0438\u0438 crctl:");
    console.log("");
    for (const s of sessions) {
      const pidResult = run("tmux", [
        "list-panes",
        "-t",
        s.name,
        "-F",
        "#{pane_pid}"
      ]);
      const pid = pidResult.stdout || "\u2014";
      console.log(`  \u{1F4C2} ${s.cwd}`);
      console.log(`     \u0421\u0435\u0441\u0441\u0438\u044F: ${s.name}`);
      console.log(`     PID: ${pid}`);
      if (s.link) {
        console.log(`     \u{1F517} ${s.link}`);
      }
      console.log("");
    }
    return;
  }
  const cwd = process.cwd();
  const name = sessionName(cwd);
  const active = sessionExists(name);
  const pids = findClaudeProcesses();
  const data = loadSessions();
  const entry = data.sessions[cwd];
  if (active) {
    console.log(`\u2705 \u0421\u0435\u0441\u0441\u0438\u044F \u0430\u043A\u0442\u0438\u0432\u043D\u0430 \u0434\u043B\u044F ${cwd}`);
    console.log(`   \u0421\u0435\u0441\u0441\u0438\u044F: ${name}`);
    if (entry?.link) {
      console.log(`   \u{1F517} ${entry.link}`);
    }
    if (pids.length > 0) {
      console.log(`   PID: ${pids.join(" ")}`);
    }
  } else {
    console.log(`\u274C \u0421\u0435\u0441\u0441\u0438\u044F \u043D\u0435 \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u0430 \u0434\u043B\u044F ${cwd}`);
    if (pids.length > 0) {
      console.log(`\u26A0\uFE0F  \u041D\u043E \u0435\u0441\u0442\u044C \u0437\u0430\u0432\u0438\u0441\u0448\u0438\u0435 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u044B: ${pids.join(" ")}`);
      console.log("   \u0417\u0430\u043F\u0443\u0441\u0442\u0438: crctl stop");
    }
  }
}
function cmdAttach() {
  const cwd = process.cwd();
  const name = sessionName(cwd);
  if (!sessionExists(name)) {
    console.log(`\u274C \u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0439 \u0441\u0435\u0441\u0441\u0438\u0438 \u0434\u043B\u044F ${cwd}`);
    console.log("   \u0417\u0430\u043F\u0443\u0441\u0442\u0438: crctl start");
    process.exit(1);
  }
  run("tmux", ["attach-session", "-t", name]);
}
function cmdLink() {
  const cwd = process.cwd();
  const name = sessionName(cwd);
  const data = loadSessions();
  const entry = data.sessions[cwd];
  if (entry?.link) {
    console.log(entry.link);
    return;
  }
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
  console.log("\u274C \u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430");
  process.exit(1);
}
function cmdDoctor() {
  const checks = [
    {
      name: "Node.js",
      check: () => {
        const version = execSync("node --version", {
          encoding: "utf8"
        }).trim();
        return { ok: true, info: version };
      }
    },
    {
      name: "tmux",
      check: () => {
        const result = run("tmux", ["-V"]);
        return {
          ok: result.code === 0,
          info: result.stdout || "\u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D"
        };
      }
    },
    {
      name: "claude",
      check: () => {
        const result = run("claude", ["--version"]);
        return {
          ok: result.code === 0,
          info: result.stdout || result.stderr || "\u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D"
        };
      }
    },
    {
      name: "Shell",
      check: () => {
        const shell = process.env.SHELL || "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E";
        return { ok: true, info: shell };
      }
    },
    {
      name: "Platform",
      check: () => {
        const platform = process.platform === "darwin" ? "macOS" : process.platform;
        return { ok: true, info: `${platform} ${process.arch}` };
      }
    }
  ];
  console.log("\u{1FA7A} \u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u0435\u0439 crctl:\n");
  let allOk = true;
  for (const c of checks) {
    const { ok, info } = c.check();
    const icon = ok ? "\u2705" : "\u274C";
    console.log(`  ${icon} ${c.name.padEnd(12)} ${info}`);
    if (!ok) allOk = false;
  }
  console.log("");
  if (!allOk) {
    console.log("\u26A0\uFE0F  \u041D\u0435\u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u0438 \u043D\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B.");
    console.log("");
    if (process.platform === "darwin") {
      console.log("\u{1F34E} \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043D\u0430 macOS:");
      console.log("  brew install node");
      console.log("  brew install tmux");
      console.log("  npm install -g @anthropic-ai/claude-code");
    } else {
      console.log("\u{1F427} \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043D\u0430 Linux:");
      console.log("  # Node.js: nvm install --lts \u0438\u043B\u0438 \u043F\u0430\u043A\u0435\u0442 \u0438\u0437 \u0440\u0435\u043F\u043E\u0437\u0438\u0442\u043E\u0440\u0438\u044F");
      console.log("  sudo dnf install tmux");
      console.log("  npm install -g @anthropic-ai/claude-code");
    }
  } else {
    console.log("\u2705 \u0412\u0441\u0435 \u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u0438 \u0433\u043E\u0442\u043E\u0432\u044B!");
  }
}
var FISH_COMPLETION = `
# crctl \u2014 fish completion
complete -c crctl -f -n '__fish_use_subcommand' -a 'start' -d 'Start Claude Code in remote-control mode'
complete -c crctl -f -n '__fish_use_subcommand' -a 'stop' -d 'Stop Claude Code session'
complete -c crctl -f -n '__fish_use_subcommand' -a 'status' -d 'Show Claude Code session status'
complete -c crctl -f -n '__fish_use_subcommand' -a 'attach' -d 'Attach to tmux session'
complete -c crctl -f -n '__fish_use_subcommand' -a 'link' -d 'Print browser link'
complete -c crctl -f -n '__fish_use_subcommand' -a 'doctor' -d 'Check dependencies'
complete -c crctl -f -n '__fish_use_subcommand' -a 'setup' -d 'Install shell completions'
complete -c crctl -f -n '__fish_use_subcommand' -a 'generate' -d 'Generate completion script'
complete -c crctl -f -n '__fish_seen_short_option "-V"' -s V -l version -d 'Version'
complete -c crctl -f -n '__fish_seen_short_option "-h"' -s h -l help -d 'Help'
complete -c crctl -f -n '__fish_complete_subcommand crctl stop' -s g -l global -d 'Stop ALL sessions'
complete -c crctl -f -n '__fish_complete_subcommand crctl status' -s g -l global -d 'Show all sessions'
complete -c crctl generate -f -a 'bash fish zsh' -d 'Shell type'
`;
var BASH_COMPLETION = `
# crctl \u2014 bash completion
_crctl() {
    local cur prev cmds
    cmds="start stop status attach link doctor setup generate"
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"

    case $prev in
        crctl)
            COMPREPLY=( $(compgen -W "\${cmds}" -- "\${cur}") )
            ;;
        generate)
            COMPREPLY=( $(compgen -W "bash fish zsh" -- "\${cur}") )
            ;;
        stop|status)
            COMPREPLY=( $(compgen -W "-g --global" -- "\${cur}") )
            ;;
        *)
            COMPREPLY=( $(compgen -W "-h --help -V --version" -- "\${cur}") )
            ;;
    esac
}
complete -F _crctl crctl
`;
var ZSH_COMPLETION = `
# crctl \u2014 zsh completion
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
    )

    _arguments -C         '(- *){-V,--version}'         '(- *){-h,--help}'         '1: :->cmds'         '*::arg:->args' && return 0

    case $state in
        cmds)
            _describe 'command' commands ;;
        args)
            case $words[1] in
                stop|status)
                    _arguments '(-g,--global)'                         '(-g --global){-g,--global}[Stop/Show ALL sessions]' ;;
                generate)
                    _arguments '1:shell:(bash fish zsh)' ;;
            esac ;;
    esac
}

_crctl "@"
`;
function cmdGenerate(shell) {
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
      console.log(`\u274C \u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 shell: ${shell}`);
      console.log("   \u041F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u044B\u0435: bash, fish, zsh");
      process.exit(1);
  }
}
function cmdSetup() {
  const shell = process.env.SHELL || "";
  let shellName;
  if (shell.includes("fish")) {
    shellName = "fish";
  } else if (shell.includes("zsh")) {
    shellName = "zsh";
  } else {
    shellName = "bash";
  }
  console.log(`\u{1F41A} \u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D shell: ${shellName} (${shell})`);
  const scripts = {
    fish: FISH_COMPLETION.trim(),
    bash: BASH_COMPLETION.trim(),
    zsh: ZSH_COMPLETION.trim()
  };
  const compScript = scripts[shellName];
  if (shellName === "fish") {
    const completionsDir = join(homedir(), ".config", "fish", "completions");
    const targetPath = join(completionsDir, "crctl.fish");
    try {
      mkdirSync(completionsDir, { recursive: true });
      writeFileSync(targetPath, compScript);
      console.log(`\u2705 \u0410\u0432\u0442\u043E\u0434\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E: ${targetPath}`);
      console.log("");
      console.log("   \u041F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u0438 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B \u0438\u043B\u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0438:");
      console.log(`   fish_update_completions`);
    } catch (err) {
      console.log("\u274C \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438.");
      console.log("");
      console.log("   \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u0438 \u0432\u0440\u0443\u0447\u043D\u0443\u044E:");
      console.log(`   mkdir -p ${completionsDir}`);
      console.log(`   crctl generate fish > ${targetPath}`);
    }
  } else if (shellName === "bash") {
    const targetPath = join(homedir(), ".bash_completion_crctl");
    try {
      writeFileSync(targetPath, compScript);
      console.log(`\u2705 \u0421\u043A\u0440\u0438\u043F\u0442 \u0430\u0432\u0442\u043E\u0434\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F: ${targetPath}`);
      console.log("");
      console.log("   \u0414\u043E\u0431\u0430\u0432\u044C \u0432 ~/.bashrc:");
      console.log(`   source ${targetPath}`);
    } catch (err) {
      console.log("\u274C \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C.");
      console.log("");
      console.log("   \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u0438 \u0432\u0440\u0443\u0447\u043D\u0443\u044E:");
      console.log(`   crctl generate bash > ${targetPath}`);
      console.log(`   echo 'source ${targetPath}' >> ~/.bashrc`);
    }
  } else if (shellName === "zsh") {
    const zshDir = join(homedir(), ".oh-my-zsh", "custom", "plugins", "crctl");
    const targetPath = join(zshDir, "_crctl");
    try {
      mkdirSync(zshDir, { recursive: true });
      writeFileSync(targetPath, compScript);
      console.log(`\u2705 \u0421\u043A\u0440\u0438\u043F\u0442 \u0430\u0432\u0442\u043E\u0434\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F: ${targetPath}`);
      console.log("");
      console.log("   \u0414\u043E\u0431\u0430\u0432\u044C 'crctl' \u0432 plugins \u0432 ~/.zshrc");
    } catch (err) {
      console.log("\u274C \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C.");
      console.log("");
      console.log("   \u0423\u0441\u0442\u0430\u043D\u043E\u0432\u0438 \u0432\u0440\u0443\u0447\u043D\u0443\u044E:");
      console.log(`   crctl generate zsh > /usr/local/share/zsh/site-functions/_crctl`);
    }
  }
}
var program = new Command();
program.name("crctl").description("Claude Remote Control \u2014 manage Claude Code sessions via tmux").version("0.2.0");
program.command("start").description("Start Claude Code in remote-control mode (current directory)").action(cmdStart);
program.command("stop").description("Stop Claude Code session (current directory)").option("-g, --global", "Stop ALL sessions in all directories").action(cmdStop);
program.command("status").description("Show Claude Code session status").option("-g, --global", "Show all sessions in all directories").action((opts) => cmdStatus({ global: !!opts.global }));
program.command("attach").description("Attach to the current directory's tmux session").action(cmdAttach);
program.command("link").description("Print the browser link for the current directory's session").action(cmdLink);
program.command("doctor").description("Check all dependencies and show install instructions").action(cmdDoctor);
program.command("generate").description("Generate shell completion script (bash|fish|zsh)").argument("<shell>", "Shell type: bash, fish, or zsh").action(cmdGenerate);
program.command("setup").description(
  "Auto-detect your shell and install completions"
).action(cmdSetup);
program.parse();
