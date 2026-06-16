import { Command } from "commander";
import {
  cmdAttach,
  cmdDetach,
  cmdDoctor,
  cmdGenerate,
  cmdLink,
  cmdRestore,
  cmdServiceInstall,
  cmdServiceStatus,
  cmdServiceUninstall,
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
  .option(
    "--spawn <mode>",
    "Spawn mode: same-dir (default) or worktree (isolated git worktree per session)",
    "same-dir"
  )
  .argument(
    "[claudeArgs...]",
    "Extra flags forwarded verbatim to `claude remote-control` (put them after `--`)"
  )
  .addHelpText(
    "after",
    `
Examples:
  crctl start
  crctl start --spawn=worktree
  crctl start -- --model opus --dangerously-skip-permissions
  crctl start --spawn=worktree -- --model opus

Anything after \`--\` is passed straight to \`claude remote-control\` and is
remembered, so \`crctl restore\` / autostart bring the session back with the
same flags.`
  )
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
  .command("detach")
  .description("Detach from session without stopping it (alias: Ctrl+B D inside tmux)")
  .action(cmdDetach);

program
  .command("link")
  .description("Print the browser link for the current directory's session")
  .action(cmdLink);

program
  .command("restore")
  .description("Re-start all registered sessions that aren't running (used by the autostart service)")
  .action(cmdRestore);

const service = program
  .command("service")
  .description("Manage the autostart service (restore sessions after login)");

service
  .command("install")
  .description("Install and enable the autostart service")
  .action(cmdServiceInstall);

service
  .command("uninstall")
  .description("Disable and remove the autostart service")
  .action(cmdServiceUninstall);

service
  .command("status")
  .description("Show whether the autostart service is installed")
  .action(cmdServiceStatus);

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
