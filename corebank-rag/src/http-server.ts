import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { retrieve, type UserTier } from "./retrieval/retrieval-endpoint.js";
import { estimateRequestCost } from "./cost.js";

// Configuration comes from the environment — never from code. The defaults
// keep the Day 8 UI working unchanged (port 3002, 300ms simulated latency).
const PORT = Number(process.env.PORT ?? 3002);
const VERSION = process.env.VERSION ?? "v1";
const LATENCY_MS = Number(process.env.LATENCY_MS ?? 300);
// Fault injection exists ONLY for non-production canary drills. It is ignored
// when NODE_ENV=production so a stray environment variable can never fail
// real traffic.
const FAULT_RATE = process.env.NODE_ENV === "production" ? 0 : Number(process.env.FAULT_RATE ?? 0);

const server = createServer(async (req, res) => {
  const started = Date.now();
  const traceId = (req.headers["x-trace-id"] as string) ?? randomUUID(); // reuse the caller's id so one request is traceable end to end
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("X-Service-Version", VERSION);
  res.setHeader("X-Trace-Id", traceId);

  const log = (fields: Record<string, unknown>) =>
    console.log(JSON.stringify({ ts: new Date().toISOString(), trace: traceId, version: VERSION, ...fields }));

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", version: VERSION }));
    return;
  }

  if (req.method === "GET" && req.url?.startsWith("/retrieve")) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const query = url.searchParams.get("query") ?? "";
    const userTier = (url.searchParams.get("userTier") ?? "public") as UserTier;
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "3");

    if (!query.trim()) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "query is required" }));
      log({ path: "/retrieve", status: 400, latencyMs: Date.now() - started });
      return;
    }

    await new Promise((r) => setTimeout(r, LATENCY_MS));

    if (Math.random() < FAULT_RATE) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "injected fault" }));
      log({ path: "/retrieve", status: 500, latencyMs: Date.now() - started, fault: true });
      return;
    }

    const result = retrieve({ query, userTier, page, pageSize });
    const contextChars = result.results.reduce((n, r) => n + r.snippet.length, 0);
    const cost = estimateRequestCost({ cached: result.cached, queryChars: query.length, contextChars });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    log({
      path: "/retrieve", status: 200, tier: userTier, cached: result.cached,
      results: result.results.length, latencyMs: Date.now() - started,
      estCostUsd: Number(cost.total.toFixed(6)),
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, () => console.log(JSON.stringify({ event: "listening", port: PORT, version: VERSION })));
