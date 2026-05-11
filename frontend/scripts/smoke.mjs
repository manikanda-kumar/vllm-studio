#!/usr/bin/env node
// Smoke test — agent-parseable HTTP probes. Zero deps (node built-ins only).

const BASE = (() => {
  const flag = process.argv.indexOf("--base-url");
  if (flag !== -1 && process.argv[flag + 1]) return process.argv[flag + 1];
  return process.env.SMOKE_BASE_URL ?? "http://localhost:3210";
})();

const JSON_MODE = process.argv.includes("--json");

const routes = [
  { path: "/", expect: 200 },
  { path: "/agent", expect: 200 },
  { path: "/settings", expect: 200 },
  { path: "/configs", expect: 307, redirect: "manual" },
  { path: "/api/agent/projects", expect: 200 },
  { path: "/api/agent/mobile/health", expect: [200, 503] },
];

function isExpected(status, expect) {
  if (Array.isArray(expect)) return expect.includes(status);
  return status === expect;
}

async function probe({ path, expect, redirect }) {
  const url = new URL(path, BASE).href;
  const start = performance.now();
  try {
    const res = await fetch(url, { redirect });
    const ms = Math.round(performance.now() - start);
    const ok = isExpected(res.status, expect);
    return {
      path,
      status: res.status,
      ms,
      ok,
      reason: ok ? undefined : `expected ${JSON.stringify(expect)}, got ${res.status}`,
    };
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    const connRefused = err?.cause?.code === "ECONNREFUSED" || err?.code === "ECONNREFUSED";
    return {
      path,
      status: connRefused ? "conn-refused" : "error",
      ms,
      ok: false,
      reason: connRefused ? "server not running" : String(err),
    };
  }
}

async function main() {
  const results = await Promise.all(routes.map(probe));

  const anyConnRefused = results.some((r) => r.status === "conn-refused");
  const failCount = results.filter((r) => !r.ok).length;
  const passCount = results.filter((r) => r.ok).length;
  const totalMs = Math.round(results.reduce((sum, r) => sum + r.ms, 0));

  if (JSON_MODE) {
    const out = {
      results: results.map((r) => ({
        route: r.path,
        status: r.status,
        ms: r.ms,
        pass: r.ok,
        reason: r.reason,
      })),
      summary: { pass: passCount, fail: failCount, total: results.length, ms: totalMs },
    };
    const fs = await import("node:fs");
    const dir = "test-artifacts";
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
    fs.writeFileSync(`${dir}/smoke.json`, JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out.results, null, 2));
  } else {
    for (const r of results) {
      const tag = r.ok ? "PASS" : "FAIL";
      const reason = r.reason ? ` reason="${r.reason}"` : "";
      console.log(`${tag} route=${r.path} status=${r.status} ms=${r.ms}${reason}`);
    }
    console.log(`SMOKE pass=${passCount} fail=${failCount} total=${results.length} ms=${totalMs}`);
  }

  if (anyConnRefused) process.exit(2);
  if (failCount > 0) process.exit(1);
  process.exit(0);
}

main();
