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

  it("GET /studio/providers returns array", async () => {
    const res = await fetch(`${server.url}/studio/providers`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("providers");
    expect(Array.isArray(body.providers)).toBe(true);
  });

  it("GET /config returns system config", async () => {
    const res = await fetch(`${server.url}/config`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("config");
    expect(body).toHaveProperty("services");
    expect(Array.isArray(body.services)).toBe(true);
  }, 30_000);

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
