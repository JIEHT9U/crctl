# Changelog

## [0.9.1](https://github.com/JIEHT9U/crctl/compare/v0.9.0...v0.9.1) (2026-06-16)

### Bug Fixes

* don't report dead sessions as started; fail clearly on missing dirs ([85acc56](https://github.com/JIEHT9U/crctl/commit/85acc5689af5898d6528fdba5a5b3d0994ac6596))

## [0.9.0](https://github.com/JIEHT9U/crctl/compare/v0.8.2...v0.9.0) (2026-06-16)

### Features

* forward user flags to claude via `crctl start -- <flags>` ([98ef31c](https://github.com/JIEHT9U/crctl/commit/98ef31c833e2b98ea53e024a8bc3ee16ab6f1fe3))

## [0.8.2](https://github.com/JIEHT9U/crctl/compare/v0.8.1...v0.8.2) (2026-06-15)

### Bug Fixes

* auto-trust the workspace so detached start doesn't hang ([a648931](https://github.com/JIEHT9U/crctl/commit/a648931d5c9bc441c6e51f7b9200fdc493db5b76))

## [0.8.1](https://github.com/JIEHT9U/crctl/compare/v0.8.0...v0.8.1) (2026-06-15)

### Bug Fixes

* add restore and service commands to shell completions ([f1a625b](https://github.com/JIEHT9U/crctl/commit/f1a625b9b40272b803e08c0cc3d7f237a7fffd34))

## [0.8.0](https://github.com/JIEHT9U/crctl/compare/v0.7.0...v0.8.0) (2026-06-15)

### Features

* autostart sessions after reboot via systemd/launchd ([a1229e0](https://github.com/JIEHT9U/crctl/commit/a1229e09735c2f88d147e1ee303fce8bd4944df1))

## [0.7.0](https://github.com/JIEHT9U/crctl/compare/v0.6.1...v0.7.0) (2026-06-11)

### Features

* --spawn flag for start, Option+D detach key, platform hints ([e953dc0](https://github.com/JIEHT9U/crctl/commit/e953dc0d2b4fc3d317e5eafb75c3fe792ed778d0))

## [0.6.1](https://github.com/JIEHT9U/crctl/compare/v0.6.0...v0.6.1) (2026-06-11)

### Bug Fixes

* improve attach UX — clear detach hint box and tmux status bar ([880818f](https://github.com/JIEHT9U/crctl/commit/880818f48325073ed1e0acac1dfab7250c50f1f5))

## [0.6.0](https://github.com/JIEHT9U/crctl/compare/v0.5.0...v0.6.0) (2026-06-11)

### Features

* add crctl detach command, show Ctrl+B D hint on attach ([7ddfcbc](https://github.com/JIEHT9U/crctl/commit/7ddfcbc83b8b90a40686748eaacfd83096c1f614))

## [0.5.0](https://github.com/JIEHT9U/crctl/compare/v0.4.1...v0.5.0) (2026-06-11)

### Features

* refactor into modules, add full test suite, fix attach/stop/link bugs ([92c8f10](https://github.com/JIEHT9U/crctl/commit/92c8f1045eacc7714921cc531ddf95f1d8ad30ba))

## [0.4.1](https://github.com/JIEHT9U/crctl/compare/v0.4.0...v0.4.1) (2026-06-11)

### Bug Fixes

* fish auto-completion errors — replace deprecated __fish_seen_short_option ([5fe4955](https://github.com/JIEHT9U/crctl/commit/5fe4955e962572f6b80fd321b694f623c5bcecb2))

## [0.4.0](https://github.com/JIEHT9U/crctl/compare/v0.3.3...v0.4.0) (2026-06-11)

### Bug Fixes

* inject version via banner instead of define (fix CI) ([4daeb23](https://github.com/JIEHT9U/crctl/commit/4daeb23591852c1c3f8ddb92d1700a5ee44ddeb5))

## [0.3.3](https://github.com/JIEHT9U/crctl/compare/v0.3.2...v0.3.3) (2026-06-11)

### Bug Fixes

* build after version bump so dist has correct version ([58c1a95](https://github.com/JIEHT9U/crctl/commit/58c1a959aa40db40617fac489dc0fc0d3f8b67a0))

## [0.3.2](https://github.com/JIEHT9U/crctl/compare/v0.3.1...v0.3.2) (2026-06-11)

### Bug Fixes

* use GITHUB_RELESE_TOKEN in release-it config ([5313ae7](https://github.com/JIEHT9U/crctl/commit/5313ae72ae989353edaad4ed8ff059e5219b622b))

## [0.3.1](https://github.com/JIEHT9U/crctl/compare/v0.3.0...v0.3.1) (2026-06-11)

### Bug Fixes

* use define instead of replace in tsup for version injection ([d6b4783](https://github.com/JIEHT9U/crctl/commit/d6b478335d70d7eca9454327f85e23024212d6eb))

## [0.3.0](https://github.com/JIEHT9U/crctl/compare/v0.2.3...v0.3.0) (2026-06-11)

### Features

* add update and uninstall commands ([8c62717](https://github.com/JIEHT9U/crctl/commit/8c627179aacda088c5a7992106d1994db428dbe8))

## [](https://github.com/JIEHT9U/crctl/compare/v0.2.2...vnull) (2026-06-11)

## [](https://github.com/JIEHT9U/crctl/compare/v0.2.1...vnull) (2026-06-11)

## [0.2.1](https://github.com/JIEHT9U/crctl/compare/v0.2.0...v0.2.1) (2026-06-11)

### Features

* **ci:** add CI workflow and release-it automation ([510c99b](https://github.com/JIEHT9U/crctl/commit/510c99be8ae525bd5f26d907d6f435361e13db26))
