import { vi } from "vitest";

/** Capture console.log output; returns a function joining everything logged. */
export function captureLog() {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  return {
    spy,
    output: () => spy.mock.calls.map((c) => c.join(" ")).join("\n"),
  };
}

/** Make process.exit throw so tests can assert on it instead of dying. */
export function trapExit() {
  return vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`process.exit(${code ?? 0})`);
  }) as never);
}

/** Pin process.cwd() to a fixed directory. */
export function mockCwd(dir: string) {
  return vi.spyOn(process, "cwd").mockReturnValue(dir);
}
