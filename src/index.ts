import { Command } from "commander";
import {
  cmdAttach,
  cmdDoctor,
  cmdGenerate,
  cmdLink,
  cmdSetup,
  cmdStart,
  cmdStatus,
  cmdStop,
  cmdUninstall,
  cmdUpdate,
} from "./commands";

declare const __VERSION__: string; // Injected by tsup at build time

const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";

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
  .action(cmdStatus);

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
  .description("Auto-detect your shell and install completions")
  .action(cmdSetup);

program
  .command("update")
  .description("Check for updates and upgrade to the latest version")
  .action(() => cmdUpdate(VERSION));

program
  .command("uninstall")
  .description("Remove crctl and clean up shell configurations")
  .action(cmdUninstall);

program.parse();
