import { Command } from "commander";
import { execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

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
    console.log(`⚠️  Сессия уже активна для ${cwd}`);
    console.log(`   Подключитесь: crctl attach`);
    process.exit(0);
  }

  console.log(`🚀 Запуск Claude Code (remote-control)...`);
  console.log(`   Директория: ${cwd}`);

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

  // Ждём появления ссылки (до 15 секунд)
  let link: string | null = null;
  for (let i = 0; i < 30; i++) {
    spawnSync("sleep", ["0.5"]);
    const content = getPaneContent(name);
    link = extractLink(content);
    if (link) break;
  }

  // Сохраняем в регистр
  const data = loadSessions();
  data.sessions[cwd] = { name, cwd, pids: [], link };
  saveSessions(data);

  console.log("");
  if (link) {
    console.log("✅ Готово!");
    console.log("");
    console.log(`🔗 Ссылка для браузера:`);
    console.log(`   ${link}`);
    console.log("");
    console.log("📱 Нажми Пробел внутри сессии для QR-кода:");
    console.log(`   crctl attach`);
  } else {
    console.log("⚠️  Не удалось получить ссылку автоматически.");
    console.log("   Подключись к сессии вручную:");
    console.log(`   crctl attach`);
  }
}

function cmdStop(options: { global: boolean }) {
  const data = loadSessions();

  if (options.global) {
    // Останавливаем ВСЕ сессии
    const targets = Object.values(data.sessions).filter((s) =>
      sessionExists(s.name)
    );

    if (targets.length === 0) {
      console.log("ℹ️  Нет активных сессий.");
      return;
    }

    console.log(`🛑 Остановка всех сессий (${targets.length})...`);
    for (const s of targets) {
      console.log(`   📂 ${s.cwd}`);
      run("tmux", ["kill-session", "-t", s.name]);
      delete data.sessions[s.cwd];
    }

    spawnSync("sleep", ["1"]);
    const pids = findClaudeProcesses();
    if (pids.length > 0) {
      console.log(`   Убиваю зависшие процессы: ${pids.join(" ")}`);
      killPids(pids);
    }

    saveSessions(data);
    console.log("✅ Все сессии остановлены.");
    return;
  }

  // Текущая директория
  const cwd = process.cwd();
  const name = sessionName(cwd);
  let stopped = false;

  if (sessionExists(name)) {
    console.log(`🛑 Остановка сессии для ${cwd}...`);
    run("tmux", ["kill-session", "-t", name]);
    stopped = true;
    delete data.sessions[cwd];

    spawnSync("sleep", ["1"]);
  }

  // Добиваем зависшие процессы
  const pids = findClaudeProcesses();
  if (pids.length > 0) {
    console.log(`   Убиваю зависшие процессы: ${pids.join(" ")}`);
    killPids(pids);
  }

  saveSessions(data);

  if (stopped) {
    console.log("✅ Сессия и все процессы убиты.");
  } else if (pids.length > 0) {
    console.log("✅ Процессы убиты.");
  } else {
    console.log("ℹ️  Сессия не найдена. Всё чисто.");
  }
}

function cmdStatus(options: { global: boolean }) {
  if (options.global) {
    const data = loadSessions();
    const sessions = Object.values(data.sessions).filter((s) =>
      sessionExists(s.name)
    );

    if (sessions.length === 0) {
      // Проверяем через tmux на случай, если регистр пустой
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
          return { name: parts[0], path: parts[1] || "неизвестно" };
        })
        .filter((s) => s.name.startsWith(SESSION_PREFIX + "-"));

      if (tmuxSessions.length === 0) {
        console.log("Нет активных сессий crctl");
        return;
      }

      console.log("🌍 Активные сессии crctl:");
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
        console.log(`     Сессия: ${s.name}`);
        console.log(`     PID: ${pid}`);
        console.log("");
      }
      return;
    }

    console.log("🌍 Активные сессии crctl:");
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
      console.log(`     Сессия: ${s.name}`);
      console.log(`     PID: ${pid}`);
      if (s.link) {
        console.log(`     🔗 ${s.link}`);
      }
      console.log("");
    }
    return;
  }

  // Обычный режим — текущая директория
  const cwd = process.cwd();
  const name = sessionName(cwd);

  const active = sessionExists(name);
  const pids = findClaudeProcesses();
  const data = loadSessions();
  const entry = data.sessions[cwd];

  if (active) {
    console.log(`✅ Сессия активна для ${cwd}`);
    console.log(`   Сессия: ${name}`);
    if (entry?.link) {
      console.log(`   🔗 ${entry.link}`);
    }
    if (pids.length > 0) {
      console.log(`   PID: ${pids.join(" ")}`);
    }
  } else {
    console.log(`❌ Сессия не запущена для ${cwd}`);
    if (pids.length > 0) {
      console.log(`⚠️  Но есть зависшие процессы: ${pids.join(" ")}`);
      console.log("   Запусти: crctl stop");
    }
  }
}

function cmdAttach() {
  const cwd = process.cwd();
  const name = sessionName(cwd);

  if (!sessionExists(name)) {
    console.log(`❌ Нет активной сессии для ${cwd}`);
    console.log("   Запусти: crctl start");
    process.exit(1);
  }

  run("tmux", ["attach-session", "-t", name]);
}

function cmdLink() {
  const cwd = process.cwd();
  const name = sessionName(cwd);

  // Сначала ищем в регистре
  const data = loadSessions();
  const entry = data.sessions[cwd];
  if (entry?.link) {
    console.log(entry.link);
    return;
  }

  // Если нет в регистре — ищем в tmux
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

  console.log("❌ Ссылка не найдена");
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
            info: result.stdout || "не найден",
          };
        },
      },
      {
        name: "claude",
        check: () => {
          const result = run("claude", ["--version"]);
          return {
            ok: result.code === 0,
            info: result.stdout || result.stderr || "не найден",
          };
        },
      },
      {
        name: "Shell",
        check: () => {
          const shell = process.env.SHELL || "неизвестно";
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

  console.log("🩺 Проверка зависимостей crctl:\n");

  let allOk = true;
  for (const c of checks) {
    const { ok, info } = c.check();
    const icon = ok ? "✅" : "❌";
    console.log(`  ${icon} ${c.name.padEnd(12)} ${info}`);
    if (!ok) allOk = false;
  }

  console.log("");
  if (!allOk) {
    console.log("⚠️  Некоторые зависимости не установлены.");
    console.log("");
    if (process.platform === "darwin") {
      console.log("🍎 Установка на macOS:");
      console.log("  brew install node");
      console.log("  brew install tmux");
      console.log("  npm install -g @anthropic-ai/claude-code");
    } else {
      console.log("🐧 Установка на Linux:");
      console.log("  # Node.js: nvm install --lts или пакет из репозитория");
      console.log("  sudo dnf install tmux");
      console.log("  npm install -g @anthropic-ai/claude-code");
    }
  } else {
    console.log("✅ Все зависимости готовы!");
  }
}

// ─── Completions ────────────────────────────────────────────

const FISH_COMPLETION = `
# crctl — fish completion
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

const BASH_COMPLETION = `
# crctl — bash completion
_crctl() {
    local cur prev cmds
    cmds="start stop status attach link doctor setup generate"
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
      console.log(`❌ Неизвестный shell: ${shell}`);
      console.log("   Поддерживаемые: bash, fish, zsh");
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

  console.log(`🐚 Обнаружен shell: ${shellName} (${shell})`);

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
      console.log(`✅ Автодополнение установлено: ${targetPath}`);
      console.log("");
      console.log("   Перезагрузи терминал или выполни:");
      console.log(`   fish_update_completions`);
    } catch (err: any) {
      console.log("❌ Не удалось установить автоматически.");
      console.log("");
      console.log("   Установи вручную:");
      console.log(`   mkdir -p ${completionsDir}`);
      console.log(`   crctl generate fish > ${targetPath}`);
    }
  } else if (shellName === "bash") {
    const targetPath = join(homedir(), ".bash_completion_crctl");

    try {
      writeFileSync(targetPath, compScript);
      console.log(`✅ Скрипт автодополнения: ${targetPath}`);
      console.log("");
      console.log("   Добавь в ~/.bashrc:");
      console.log(`   source ${targetPath}`);
    } catch (err: any) {
      console.log("❌ Не удалось установить.");
      console.log("");
      console.log("   Установи вручную:");
      console.log(`   crctl generate bash > ${targetPath}`);
      console.log(`   echo 'source ${targetPath}' >> ~/.bashrc`);
    }
  } else if (shellName === "zsh") {
    const zshDir = join(homedir(), ".oh-my-zsh", "custom", "plugins", "crctl");
    const targetPath = join(zshDir, "_crctl");

    try {
      mkdirSync(zshDir, { recursive: true });
      writeFileSync(targetPath, compScript);
      console.log(`✅ Скрипт автодополнения: ${targetPath}`);
      console.log("");
      console.log("   Добавь 'crctl' в plugins в ~/.zshrc");
    } catch (err: any) {
      console.log("❌ Не удалось установить.");
      console.log("");
      console.log("   Установи вручную:");
      console.log(`   crctl generate zsh > /usr/local/share/zsh/site-functions/_crctl`);
    }
  }
}

// ─── CLI ────────────────────────────────────────────────────

const program = new Command();

program
  .name("crctl")
  .description("Claude Remote Control — manage Claude Code sessions via tmux")
  .version("0.2.0");

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

program.parse();
