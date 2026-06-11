import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  dts: false,
  clean: true,
  noExternal: ["commander"], // Bundle commander to make dist/index.js self-contained
  banner: {
    js: "#!/usr/bin/env node",
  },
});
