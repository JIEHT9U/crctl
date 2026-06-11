<div align="center">

![crctl](assets/banner.png)

<br>

# 🎛️ crctl — Claude Remote Control

**CLI utility for managing [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) sessions via tmux.**

Each directory gets its own isolated session. One command to start, one to stop.

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://github.com/JIEHT9U/crctl)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node-20+-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS-lightgray)](#)
[![Shell](https://img.shields.io/badge/Shell-fish%20%7C%20bash%20%7C%20zsh-orange?logo=terminal)](#)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🚀 **start / stop** | Launch and stop Claude Code in remote-control mode |
| 🌍 **Multi-project** | Each directory gets its own isolated session |
| 🔗 **Auto-link** | Browser link appears automatically |
| 📱 **QR-code** | Connect from your phone via `crctl attach` |
| 🐚 **Auto-completion** | Built-in for fish, bash, and zsh |
| 🩺 **Doctor** | Dependency check + install instructions |
| 🔄 **Cross-platform** | Linux and macOS out of the box |

---

## 📦 Installation

```bash
curl -fsSL https://raw.githubusercontent.com/JIEHT9U/crctl/main/install.sh | sh

# Check dependencies
crctl doctor
```

---

## 🚀 Quick Start

```bash
# 1. Start Claude Code in the current directory
crctl start

# 2. Get the browser link
crctl link
# → https://claude.ai/code?environment=env_...

# 3. Or attach via terminal
crctl attach
```

---

## 📖 Commands

```
Usage: crctl [options] [command]

Commands:
  start                   🚀 Start Claude Code (remote-control)
  stop [options]          🛑 Stop session
  status [options]        📊 Show session status
  attach                  🔌 Attach to tmux session
  link                    🔗 Print browser link
  doctor                  🩺 Check dependencies
  setup                   🐚 Install shell completions
  generate <shell>        📝 Generate completion script
```

### Flags

```bash
crctl stop --global        🛑 Stop ALL sessions
crctl status --global      🌍 Show all sessions
crctl status -g            🌍 Short form
```

---

## 🐚 Auto-completion

```bash
# Auto-install (detects fish / bash / zsh)
crctl setup

# Or manually
crctl generate fish  > ~/.config/fish/completions/crctl.fish
crctl generate bash  > ~/.bash_completion_crctl
crctl generate zsh   > /usr/local/share/zsh/site-functions/_crctl
```

---

## 💡 Examples

### Multi-project workflow

```bash
# Terminal 1
cd ~/project-alpha && crctl start

# Terminal 2
cd ~/project-beta && crctl start

# View all sessions
crctl status --global
# 🌍 Active sessions:
#   📂 ~/project-alpha  claude-rc-abc123
#   📂 ~/project-beta   claude-rc-def456

# Stop everything at once
crctl stop --global
```

### Scripts & CI

```bash
# Get link into a variable
LINK=$(crctl link)
open "$LINK"  # macOS
xdg-open "$LINK"  # Linux
```

---

## 🛠️ System Requirements

| Platform | Node.js | tmux | claude |
|---|---|---|---|
| **🐧 Linux** | `nvm install --lts` | `sudo dnf install tmux` | `npm i -g @anthropic-ai/claude-code` |
| **🍎 macOS** | `brew install node` | `brew install tmux` | `npm i -g @anthropic-ai/claude-code` |

Check everything with one command: `crctl doctor`

---

## 🏗️ Architecture

```
crctl/
├── src/
│   └── index.ts          # Main code (~300 lines TS)
├── assets/
│   └── banner.png        # Banner (Flux AI)
├── dist/
│   └── index.js          # Compiled bundle (22 KB)
├── package.json
├── tsup.config.ts        # Bundler (tsup)
├── tsconfig.json
└── README.md
```

- **Commander.js** — CLI argument parsing
- **tsup** — TypeScript → single JS bundle
- **Node.js built-in** — `child_process`, `crypto`, `fs`
- **tmux** — background session management

---

## 📄 License

[MIT](LICENSE)
