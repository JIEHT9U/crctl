# crctl — Agent & Contributor Guide

CLI utility for managing Claude Code remote-control sessions via tmux.
One tmux session per project directory; the session name is derived from an
md5 hash of the directory path (`claude-rc-<hash>`).

## Commands

```bash
npm run build       # bundle to dist/index.cjs (tsup, single CJS file)
npm test            # run the vitest suite (unit + e2e smoke)
npm run test:watch  # vitest in watch mode
npm run typecheck   # tsc --noEmit
```

Run `node dist/index.cjs <command>` to try the built CLI locally.

## Architecture

```
src/
├── index.ts        # CLI wiring only (commander). No logic here.
├── constants.ts    # session prefix, config paths, polling intervals
├── types.ts        # all shared interfaces (SessionEntry, RunResult, …)
├── utils.ts        # pure helpers: dirHash, sessionName, extractLink, sleep
├── registry.ts     # sessions.json load/save (path injectable for tests)
├── tmux.ts         # every tmux invocation lives here
├── processes.ts    # ps-based discovery + killing of claude processes
├── service.ts      # autostart: systemd (Linux) / launchd (macOS) unit logic
├── completions.ts  # bash/fish/zsh completion script texts
└── commands/       # one file per CLI command (start, stop, status, …)
```

Conventions:

- **All tmux calls go through `src/tmux.ts`** — never call `spawnSync("tmux", …)`
  from a command directly. Interactive commands (attach) must use
  `stdio: "inherit"`; everything else captures output via `run()`.
- **All `systemctl`/`launchctl` calls go through `src/service.ts`**, the same
  way tmux is funnelled through `tmux.ts`. Unit/plist *text* is built by pure
  exported functions there so it can be unit-tested without touching disk.
- **Commands contain orchestration + console output only.** Parsing and other
  pure logic belongs in `utils.ts` / `processes.ts` / `tmux.ts` so it can be
  unit-tested without mocks.
- `__VERSION__` is injected by the tsup banner at build time; `src/index.ts`
  guards it with `typeof` so the source also runs unbundled.
- State lives in one registry file (`~/.config/crctl/sessions.json`, or
  `~/Library/Application Support/crctl` on macOS). Treat the registry as a
  cache: tmux is the source of truth, the registry may be stale or missing
  and every command must survive that.

## Testing

- Tests live in `tests/`, mirroring `src/` (`tests/commands/<cmd>.test.ts`).
- Command tests mock the module boundaries (`../../src/tmux`,
  `../../src/registry`, `../../src/processes`) — never the real tmux.
- `tests/helpers.ts` provides `captureLog()`, `trapExit()`, `mockCwd()`.
- `tests/cli.e2e.test.ts` builds the real binary and runs the side-effect-free
  commands (`--help`, `--version`, `generate`, `doctor`).

Vitest 4 gotchas already hit in this repo — do not reintroduce them:

- `vi.restoreAllMocks()` no longer resets `vi.fn()` implementations from
  `vi.mock` factories; use `vi.resetAllMocks()` in `beforeEach`.
- Never write `beforeEach(() => mock.mockReset())` without braces:
  `mockReset()` returns the mock, and vitest calls a returned function as a
  teardown hook — i.e. it will *invoke your mock* after the test.

**Never run `crctl stop`, `stop -g`, or integration tests against the real
tmux server.** The tmux socket is per-user (`/tmp/tmux-$UID`), not per-$HOME,
so a sandboxed `$HOME` does NOT isolate you from the developer's live
sessions. If you must test against real tmux, use a private socket:
`tmux -L crctl-test …`.

## Releases

`release-it` with conventional-changelog; see `docs/RELEASE.md`.
Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, …).
CI (`.github/workflows/ci.yml`) runs typecheck → test → build on Node 20/22.
