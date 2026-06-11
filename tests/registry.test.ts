import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSessions, saveSessions } from "../src/registry";
import type { SessionsData } from "../src/types";

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "crctl-test-"));
  file = join(dir, "nested", "sessions.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("loadSessions", () => {
  it("returns an empty registry when the file does not exist", () => {
    expect(loadSessions(file)).toEqual({ sessions: {} });
  });

  it("returns an empty registry for corrupted JSON", () => {
    writeFileSync(join(dir, "broken.json"), "{not json!");
    expect(loadSessions(join(dir, "broken.json"))).toEqual({ sessions: {} });
  });

  it("returns an empty registry for valid JSON with the wrong shape", () => {
    const wrong = join(dir, "wrong.json");
    writeFileSync(wrong, JSON.stringify({ foo: "bar" }));
    expect(loadSessions(wrong)).toEqual({ sessions: {} });

    writeFileSync(wrong, JSON.stringify({ sessions: [1, 2] }));
    expect(loadSessions(wrong)).toEqual({ sessions: {} });

    writeFileSync(wrong, JSON.stringify(null));
    expect(loadSessions(wrong)).toEqual({ sessions: {} });
  });

  it("loads a previously saved registry", () => {
    const data: SessionsData = {
      sessions: {
        "/home/user/project": {
          name: "claude-rc-abc12345",
          cwd: "/home/user/project",
          pids: [123],
          link: "https://claude.ai/code?environment=xyz",
        },
      },
    };
    saveSessions(data, file);
    expect(loadSessions(file)).toEqual(data);
  });
});

describe("saveSessions", () => {
  it("creates missing parent directories", () => {
    expect(existsSync(file)).toBe(false);
    saveSessions({ sessions: {} }, file);
    expect(existsSync(file)).toBe(true);
  });

  it("writes pretty-printed JSON", () => {
    saveSessions({ sessions: {} }, file);
    expect(readFileSync(file, "utf8")).toBe(
      JSON.stringify({ sessions: {} }, null, 2)
    );
  });
});
