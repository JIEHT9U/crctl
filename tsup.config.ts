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
