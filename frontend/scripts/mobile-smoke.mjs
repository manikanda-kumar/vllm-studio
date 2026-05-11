#!/usr/bin/env node
// Mobile MCP route smoke test — agent-parseable output

const BASE = (() => {
  const flag = process.argv.indexOf("--base-url");
  if (flag !== -1 && process.argv[flag + 1]) return process.argv[flag + 1];
  return process.env.SMOKE_BASE_URL ?? "http://localhost:3210";
})();

const routes = [
  { path: "/api/agent/mobile/health", expect: [200, 503] },
  { path: "/api/agent/mobile/shutdown", method: "POST", expect: 200 },
];

async function probe({ path, method, expect }) {
  const url = new URL(path, BASE).href;
  const start = performance.now();
  try {
    const res = await fetch(url, { method: method || "GET" });
    const ms = Math.round(performance.now() - start);
    const ok = Array.isArray(expect) ? expect.includes(res.status) : res.status === expect;
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

  const failCount = results.filter((r) => !r.ok).length;
  const passCount = results.filter((r) => r.ok).length;
  const totalMs = Math.round(results.reduce((sum, r) => sum + r.ms, 0));

  for (const r of results) {
    const tag = r.ok ? "PASS" : "FAIL";
    const reason = r.reason ? ` reason="${r.reason}"` : "";
    console.log(`${tag} mobile-route=${r.path} status=${r.status} ms=${r.ms}${reason}`);
  }

  console.log(`MOBILE_SMOKE pass=${passCount} fail=${failCount} total=${results.length} ms=${totalMs}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main();
