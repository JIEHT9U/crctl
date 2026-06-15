See @AGENTS.md for the full project guide (architecture, commands, testing
conventions, and the tmux-isolation warning for integration tests).

## Gotchas

- **Adding or renaming a CLI command? Update the shell completions too.**
  The command lists in `src/completions.ts` (bash/fish/zsh) are hand-maintained
  and do NOT derive from commander, so a new command (and any subcommands, e.g.
  `service install|uninstall|status`) won't autocomplete until added there.
  `tests/completions.test.ts` guards this — add the command to its `ALL_COMMANDS`
  list so the omission fails CI.
