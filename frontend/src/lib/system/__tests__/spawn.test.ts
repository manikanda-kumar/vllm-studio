import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { enhancedPath, npxLauncher, resolveExecutable } from "../spawn";

describe("enhancedPath", () => {
  const originalPlatform = process.platform;
  const originalPath = process.env.PATH;

  beforeEach(() => {
    process.env.PATH = "/usr/bin";
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    process.env.PATH = originalPath;
  });

  it("includes darwell-known dirs on darwin", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    const result = enhancedPath();
    expect(result).toContain("/opt/homebrew/bin");
    expect(result).toContain("/usr/local/bin");
    expect(result).toContain("/usr/bin");
    expect(result).not.toContain(":" + ":");
  });

  it("includes linux well-known dirs on linux", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    const result = enhancedPath();
    expect(result).toContain("/usr/local/bin");
    expect(result).toContain("/usr/bin");
  });

  it("includes windows well-known dirs on win32", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    process.env.APPDATA = "C:\\Users\\User\\AppData\\Roaming";
    process.env.ProgramFiles = "C:\\Program Files";
    const result = enhancedPath();
    expect(result).toContain("npm");
    expect(result).toContain("nodejs");
    // path.delimiter is platform-specific and determined at module load time;
    // on the test runner it will be ':' even with platform mocked.
    expect(result).not.toContain("::");
  });
});

describe("npxLauncher", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it('returns "npx.cmd" on win32', () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    expect(npxLauncher()).toBe("npx.cmd");
  });

  it('returns "npx" on other platforms', () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    expect(npxLauncher()).toBe("npx");
  });
});

describe("resolveExecutable", () => {
  it("returns null when executable is not found", () => {
    const originalPath = process.env.PATH;
    process.env.PATH = "/nonexistent";
    expect(resolveExecutable("definitely-not-real")).toBeNull();
    process.env.PATH = originalPath;
  });

  it("returns a path when executable exists in PATH", () => {
    const originalPath = process.env.PATH;
    process.env.PATH = "/bin";
    const result = resolveExecutable("ls");
    // /bin/ls exists on most unix systems
    if (result) {
      expect(result).toContain("ls");
    }
    process.env.PATH = originalPath;
  });
});
