#!/usr/bin/env node
// Verify aggregator — typecheck → lint → unit → smoke
// Emits PASS/FAIL summary and writes test-artifacts/verify.json

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FULL = process.argv.includes("--full");
const BASE_DIR = dirname(__dirname);

const stages = [
  { name: "typecheck", cmd: "npx", args: ["tsc", "--noEmit"] },
  { name: "lint", cmd: "npx", args: ["eslint"] },
  {
    name: "unit",
    cmd: "npx",
    args: ["vitest", "run", "--passWithNoTests", "--reporter=json", "--outputFile=test-artifacts/vitest.json"],
  },
];

if (FULL) {
  stages.push({ name: "build", cmd: "npm", args: ["run", "build"] });
}

stages.push({ name: "smoke", cmd: "node", args: ["scripts/smoke.mjs"] });

async function runStage(stage) {
  const start = performance.now();
  const proc = spawn(stage.cmd, stage.args, {
    cwd: BASE_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "0" },
  });

  const stdout = [];
  const stderr = [];
  proc.stdout.on("data", (d) => stdout.push(d.toString()));
  proc.stderr.on("data", (d) => stderr.push(d.toString()));

  const exitCode = await new Promise((resolve) => proc.on("close", resolve));
  const ms = Math.round(performance.now() - start);
  const output = stdout.join("") + stderr.join("");
  const lines = output.split("\n").filter((l) => l.trim());

  return {
    name: stage.name,
    pass: exitCode === 0,
    exitCode,
    ms,
    output: lines.slice(-20).join("\n"),
    lastLine: lines.at(-1) || "",
  };
}

async function isServerUp() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch("http://localhost:3210/", { signal: controller.signal });
    clearTimeout(timer);
    return res.status === 200;
  } catch {
    return false;
  }
}

async function bootDevServer() {
  const proc = spawn("npm", ["run", "dev"], {
    cwd: BASE_DIR,
    stdio: "ignore",
    env: { ...process.env, PORT: "3210" },
    detached: true,
  });
  proc.unref();

  // Wait up to 30s for server to be ready
  const start = performance.now();
  while (performance.now() - start < 30_000) {
    if (await isServerUp()) return proc;
    await new Promise((r) => setTimeout(r, 500));
  }
  proc.kill();
  throw new Error("Dev server failed to start within 30s");
}

async function main() {
  await mkdir("test-artifacts", { recursive: true });

  let serverProc = null;
  let serverBooted = false;

  const results = [];
  const totalStart = performance.now();

  for (const stage of stages) {
    // Auto-boot dev server before smoke stage if needed
    if (stage.name === "smoke" && !(await isServerUp())) {
      process.stdout.write(`[verify] smoke … booting dev server on :3210\n`);
      serverProc = await bootDevServer();
      serverBooted = true;
    }

    process.stdout.write(`[verify] ${stage.name} … `);
    const result = await runStage(stage);
    results.push(result);

    const tag = result.pass ? "PASS" : "FAIL";
    const count = result.lastLine.match(/count=(\d+)/)?.[1];
    const countStr = count ? ` count=${count}` : "";
    process.stdout.write(`${tag} ${result.ms}ms${countStr}\n`);

    if (!result.pass) {
      process.stdout.write(`\n--- ${stage.name} last lines ---\n${result.output}\n---\n\n`);
    }
  }

  // Tear down dev server if we booted it
  if (serverBooted && serverProc) {
    try {
      process.kill(-serverProc.pid, "SIGTERM");
    } catch {
      // ignore
    }
  }

  const totalMs = Math.round(performance.now() - totalStart);
  const allPass = results.every((r) => r.pass);

  const verifyJson = {
    stages: results.map((r) => ({
      name: r.name,
      pass: r.pass,
      exitCode: r.exitCode,
      ms: r.ms,
      lastLine: r.lastLine,
    })),
    totalMs,
    pass: allPass,
  };

  await writeFile("test-artifacts/verify.json", JSON.stringify(verifyJson, null, 2));

  if (allPass) {
    console.log(`PASS verify stages=${results.length} ms=${totalMs}`);
    process.exit(0);
  } else {
    const firstFail = results.find((r) => !r.pass);
    console.log(`FAIL verify stage=${firstFail.name} ms=${totalMs}`);
    process.exit(1);
  }
}

main();
