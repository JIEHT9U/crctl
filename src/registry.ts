import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SESSIONS_FILE } from "./constants";
import type { SessionsData } from "./types";

const EMPTY: SessionsData = { sessions: {} };

/**
 * Load the session registry. Returns an empty registry when the file is
 * missing, unreadable, or does not have the expected shape.
 */
export function loadSessions(file: string = SESSIONS_FILE): SessionsData {
  if (!existsSync(file)) {
    return { sessions: {} };
  }
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    if (
      data &&
      typeof data === "object" &&
      data.sessions &&
      typeof data.sessions === "object" &&
      !Array.isArray(data.sessions)
    ) {
      return data as SessionsData;
    }
    return { sessions: {} };
  } catch {
    return { sessions: {} };
  }
}

/** Persist the session registry, creating the config directory if needed. */
export function saveSessions(
  data: SessionsData,
  file: string = SESSIONS_FILE
): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2));
}
