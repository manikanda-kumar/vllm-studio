import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { startTestServer } from "../main";

describe("controller HTTP", () => {
  let dbDir: string;
  let server: { url: string; close: () => Promise<void> };

  beforeAll(async () => {
    dbDir = await mkdtemp(path.join(tmpdir(), "vllm-ctl-"));
    process.env.VLLM_STUDIO_DATA_DIR = dbDir;
    process.env.VLLM_STUDIO_DB_PATH = path.join(dbDir, "controller.db");
    process.env.VLLM_STUDIO_ALLOW_UNAUTHENTICATED = "true";
    process.env.VLLM_STUDIO_HOST = "127.0.0.1";
    server = await startTestServer({ port: 0 });
  });

  afterAll(async () => {
    await server.close();
    await rm(dbDir, { recursive: true, force: true });
  });

  it("GET /health returns ok", async () => {
    const res = await fetch(`${server.url}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status");
  });

  it("GET /status returns controller info", async () => {
    const res = await fetch(`${server.url}/status`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("version");
  });

  it("POST /studio/settings persists models_dir", async () => {
    const newDir = path.join(dbDir, "models");
    const res = await fetch(`${server.url}/studio/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ models_dir: newDir }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.effective.models_dir).toBe(newDir);
  });
});
