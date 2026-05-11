import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const MAIN_TS = path.join(__dirname, "../../desktop/main.ts");
const MAIN_JS = path.join(__dirname, "../../desktop/dist/main.js");

function mainTsMtime(): number {
  try {
    return fs.statSync(MAIN_TS).mtimeMs;
  } catch {
    return 0;
  }
}

function mainJsMtime(): number {
  try {
    return fs.statSync(MAIN_JS).mtimeMs;
  } catch {
    return 0;
  }
}

export default async function globalSetup() {
  if (mainJsMtime() < mainTsMtime()) {
    console.log("[electron:setup] desktop/dist/main.js stale; rebuilding …");
    execSync("npm run desktop:build:main", {
      cwd: path.join(__dirname, "../.."),
      stdio: "inherit",
    });
  }
}
