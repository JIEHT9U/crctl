# Release Process

This document describes the automated release workflow for `crctl`.

---

## 1. Commit Conventions

Commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This determines how version numbers are bumped:

| Prefix | Version Bump | Example |
|---|---|---|
| `feat:` | **Minor** (`0.2.0` → `0.3.0`) | `feat: add update command` |
| `fix:` | **Patch** (`0.2.0` → `0.2.1`) | `fix: version not injecting in CI` |
| `chore:` / `docs:` / `refactor:` | **None** (no version change) | `chore: update dependencies` |

---

## 2. Creating a Release

Run the following command from the project root:

```bash
npx release-it
```

**What it does automatically:**

1.  **Reads commit history** — determines the next version based on conventional commits.
2.  **Generates `CHANGELOG.md`** — writes release notes from commit messages.
3.  **Bumps version** — updates `package.json` version field.
4.  **Builds the project** — runs `npm run build` to produce the latest `dist/index.cjs`.
5.  **Creates a git tag** — e.g., `v0.3.0`.
6.  **Pushes to GitHub** — commits and tags are pushed to `main`.
7.  **Creates GitHub Release** — uses the `GITHUB_RELESE_TOKEN` to create a release page with changelog and `.tgz` asset.

### Requirements

- `GITHUB_RELESE_TOKEN` environment variable must be set (Fine-grained or Classic PAT with `repo` scope).
- `release-it` is configured in `package.json` under the `release-it` key.

---

## 3. CI / CD Pipeline

Two GitHub Actions workflows run on every push to `main`:

### `ci.yml` — Build Check
- Runs on Node.js 20 and 22.
- Installs dependencies (`npm ci`).
- Builds the project (`npm run build`).
- Validates the binary (`node dist/index.cjs --version`).
- Must pass for the code to be considered stable.

### `release.yml` — Release Asset Generation
- Triggers on git tags matching `v*`.
- Builds the project and creates a tarball (`npm pack`).
- Attaches the `.tgz` file to the GitHub Release automatically.

---

## 4. Updating

Users who installed via `install.sh` can self-update:

```bash
crctl update
```

This checks the GitHub API for the latest release, compares versions, and re-downloads the binary if a newer version is available.

---

## 5. Uninstalling

```bash
crctl uninstall
```

Removes the binary, cleans PATH entries from shell configs (`.bashrc`, `.zshrc`, `config.fish`), and deletes completion files.

---

## 6. Quick Reference

| Action | Command |
|---|---|
| Commit a feature | `git commit -m "feat: add new feature"` |
| Commit a fix | `git commit -m "fix: correct bug"` |
| Release locally | `npx release-it` |
| Check CI status | `gh run list --repo JIEHT9U/crctl` |
| Update crctl | `crctl update` |
| Uninstall crctl | `crctl uninstall` |
| Self-install | `curl -fsSL https://raw.githubusercontent.com/JIEHT9U/crctl/main/install.sh | sh` |
