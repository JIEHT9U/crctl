---
name: build-new-cli-tool
description: Build a new TypeScript CLI tool from scratch — name suggestions, GitHub repo setup, TypeScript project scaffolding, install script, and release automation
---

# Building a New CLI Tool

## Step 1: Name the project

When the user describes what the tool should do, suggest **5-7 name variants** that are:
- Short (2-6 characters preferred)
- Memorable
- Descriptive of the core function
- Available on npm (`npm view <name> 2>/dev/null || echo "available"`)

Format:
```
| Name | Why | Available? |
|---|---|---|
| `xyz` | ... | ✅ |
```

Pick the winner with the user, then proceed.

## Step 2: Create the GitHub repo

Use `gh` CLI to create a private repo with proper metadata:

```bash
gh repo create JIEHT9U/<name> \
  --private \
  --description "<short description>" \
  --remote origin
```

Then add:
- `README.md` with banner (generate via Flux if available), badges, features table, installation, commands
- `LICENSE` (MIT)
- `.gitignore` (node_modules, dist)
- `docs/RELEASE.md` (release process)

## Step 3: Scaffold TypeScript project

Create the standard structure:

```
<name>/
├── src/
│   └── index.ts          # CLI entry point (Commander.js)
├── assets/
│   └── banner.png        # Flux-generated banner
├── dist/
│   └── index.cjs         # Compiled bundle (self-contained)
├── docs/
│   └── RELEASE.md        # Release process
├── .github/
│   └── workflows/
│       ├── ci.yml        # Build check (Node 20, 22)
│       └── release.yml   # Release asset generation
├── package.json
├── tsconfig.json
├── tsup.config.ts        # tsup bundler
├── install.sh            # curl-based installer
├── LICENSE
└── README.md
```

**package.json essentials:**
```json
{
  "name": "<name>",
  "version": "0.1.0",
  "type": "module",
  "bin": { "<name>": "./dist/index.cjs" },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch"
  },
  "dependencies": { "commander": "^12.1.0" },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsup": "^8.3.0",
    "release-it": "^20.2.0",
    "@release-it/conventional-changelog": "^10.0.0"
  },
  "engines": { "node": ">=20" },
  "release-it": {
    "github": {
      "release": true,
      "tokenRef": "GITHUB_RELESE_TOKEN"
    },
    "npm": { "publish": false },
    "plugins": {
      "@release-it/conventional-changelog": {
        "preset": "conventionalcommits",
        "infile": "CHANGELOG.md"
      }
    },
    "hooks": {
      "after:bump": "npm run build && git add -A"
    }
  }
}
```

**tsup.config.ts:**
```ts
import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node20",
  dts: false,
  clean: true,
  noExternal: ["commander"],
  banner: {
    js: `#!/usr/bin/env node\nvar __VERSION__ = "${pkg.version}";`,
  },
});
```

## Step 4: Write the CLI code

Use `Commander.js` for argument parsing. Core pattern:

```ts
import { Command } from "commander";
import { execSync, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const VERSION = __VERSION__; // Injected by tsup

const program = new Command();

program
  .name("<name>")
  .description("<description>")
  .version(VERSION);

program
  .command("start")
  .description("Start something")
  .action(cmdStart);

// ... more commands ...

program.parse();
```

## Step 5: Install script

Create `install.sh` that:
1. Checks for Node.js
2. Downloads `dist/index.cjs` from GitHub raw
3. Copies to `~/.local/bin/<name>`
4. Makes executable
5. Adds to PATH if needed (auto-detects fish/bash/zsh)

## Step 6: Test and push

```bash
npm install
npm run build
npm install -g .     # Test local install
<name> --help        # Verify it works
git init && git add -A
git commit -m "feat: initial release"
git branch -M main
git remote add origin git@github.com:JIEHT9U/<name>.git
git push -u origin main
```

## Step 7: Generate banner (if Flux is available)

```bash
# 1280x420, modern dark theme, neon accents, terminal aesthetic
```

## Step 8: Configure release automation

Set up `GITHUB_RELESE_TOKEN` and run:
```bash
npx release-it --ci --increment minor
```

This creates the first release automatically with CHANGELOG.md.
