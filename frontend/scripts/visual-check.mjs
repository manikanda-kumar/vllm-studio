#!/usr/bin/env node
// Visual feedback loop — screenshot + DOM snapshot via CDP/agent-browser

import { spawn, execSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_DIR = dirname(__dirname);
const CDP_PORT = process.env.VLLM_STUDIO_DESKTOP_CDP_PORT || "9333";
const ARTIFACT_DIR = "test-artifacts/visual";

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

function cdpUp() {
  try {
    const out = execSync(`curl -s -m 2 http://localhost:${CDP_PORT}/json/version`, { encoding: "utf-8" });
    return JSON.parse(out).Browser !== undefined;
  } catch {
    return false;
  }
}

function bootElectron() {
  const proc = spawn("npm", ["run", "desktop:start:dev"], {
    cwd: BASE_DIR,
    stdio: "ignore",
    env: { ...process.env, VLLM_STUDIO_DESKTOP_CDP_PORT: CDP_PORT },
    detached: true,
  });
  proc.unref();
  return proc;
}

async function waitForCdp(maxMs = 30_000) {
  const start = performance.now();
  while (performance.now() - start < maxMs) {
    if (cdpUp()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function runAgentBrowser(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("agent-browser", args, { cwd: BASE_DIR, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    proc.stdout.on("data", (d) => stdout.push(d.toString()));
    proc.stderr.on("data", (d) => stderr.push(d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`agent-browser exited ${code}: ${stderr.join("")}`));
      } else {
        resolve(stdout.join(""));
      }
    });
  });
}

async function main() {
  await ensureDir(ARTIFACT_DIR);
  const start = performance.now();

  let booted = false;
  if (!cdpUp()) {
    process.stdout.write("[visual] CDP not up; booting electron …\n");
    bootElectron();
    if (!(await waitForCdp())) {
      console.error("FAIL visual reason=\"CDP did not come up within 30s\"");
      process.exit(1);
    }
    booted = true;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const screenshotPath = `${ARTIFACT_DIR}/${ts}.png`;
  const domPath = `${ARTIFACT_DIR}/${ts}.json`;

  try {
    await runAgentBrowser(["connect", CDP_PORT, "--session", "vllm"]);
  } catch {
    // Session may already exist
  }

  try {
    await runAgentBrowser(["--session", "vllm", "screenshot", screenshotPath]);
  } catch (err) {
    console.error(`FAIL visual reason="screenshot failed: ${err.message}"`);
    process.exit(1);
  }

  try {
    const dom = await runAgentBrowser(["--session", "vllm", "snapshot", "-i"]);
    const fs = await import("node:fs/promises");
    await fs.writeFile(domPath, dom);
  } catch (err) {
    console.error(`FAIL visual reason="dom snapshot failed: ${err.message}"`);
    process.exit(1);
  }

  const ms = Math.round(performance.now() - start);
  console.log(`VISUAL screenshot=${screenshotPath} dom=${domPath} ms=${ms}`);
  process.exit(0);
}

main();
