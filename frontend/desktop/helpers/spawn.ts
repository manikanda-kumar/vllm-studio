import path from "node:path";
import os from "node:os";

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
