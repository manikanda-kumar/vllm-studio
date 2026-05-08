import path from "node:path";
import os from "node:os";
import { existsSync } from "node:fs";

/**
 * Returns an enhanced PATH string that includes well-known directories
 * for the current platform, using the correct path separator.
 */
export function enhancedPath(): string {
  const platform = os.platform();
  const extraDirs: string[] = [];
  if (platform === "darwin") {
    extraDirs.push("/opt/homebrew/bin", "/usr/local/bin", "/opt/local/bin");
  } else if (platform === "linux") {
    extraDirs.push("/usr/local/bin", "/usr/bin");
  } else if (platform === "win32") {
    if (process.env.APPDATA) extraDirs.push(path.join(process.env.APPDATA, "npm"));
    if (process.env.ProgramFiles) extraDirs.push(path.join(process.env.ProgramFiles, "nodejs"));
  }
  return [...extraDirs, process.env.PATH].filter(Boolean).join(path.delimiter);
}

/**
 * Walk PATH directories looking for an executable with the given name.
 * Returns the full path if found, otherwise null.
 */
export function resolveExecutable(name: string): string | null {
  const pathEnv = process.env.PATH || "";
  const dirs = pathEnv.split(path.delimiter);
  for (const dir of dirs) {
    const fullPath = path.join(dir, name);
    if (existsSync(fullPath)) return fullPath;
  }
  return null;
}

/**
 * Returns the correct npx launcher for the current platform.
 */
export function npxLauncher(): string {
  return os.platform() === "win32" ? "npx.cmd" : "npx";
}
