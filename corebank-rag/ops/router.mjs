// A minimal canary router. It does with ~80 lines what a service mesh, an
// Argo Rollouts / Flagger controller, or a cloud deploy service does in
// production: split traffic, watch the canary's health, and roll back on its
// own — without waiting for a human to notice.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

const env = process.env;
const STABLE = env.STABLE_URL ?? "http://localhost:4001";
const CANARY = env.CANARY_URL ?? "http://localhost:4002";
const STEPS = (env.CANARY_STEPS ?? "20,50,100").split(",").map(Number); // traffic % at each stage
const MIN_SAMPLES = Number(env.MIN_SAMPLES ?? 20);                       // canary requests judged per stage
const ERROR_THRESHOLD = Number(env.ERROR_THRESHOLD ?? 0.2);              // roll back above this error rate
const PORT = Number(env.ROUTER_PORT ?? 8080);

const state = { status: "CANARY", stepIndex: 0, weight: STEPS[0], window: [], counts: { stable: 0, canary: 0 }, events: [] };

const emit = (event, extra = {}) => {
  const e = { ts: new Date().toISOString(), event, ...extra };
  state.events.push(e);
  console.log(JSON.stringify(e));
  writeFileSync(env.STATE_FILE ?? "ops/deploy-state.json", JSON.stringify({ ...state, window: undefined }, null, 2));
};

function judgeCanary(ok) {
  if (state.status !== "CANARY") return;
  state.window.push(ok);
  if (state.window.length < MIN_SAMPLES) return;
  const errors = state.window.filter((x) => !x).length;
  const errorRate = errors / state.window.length;
  if (errorRate > ERROR_THRESHOLD) {
    state.status = "ROLLED_BACK";
    state.weight = 0;                       // all traffic returns to stable, instantly
    emit("ROLLBACK", { reason: "canary error rate above threshold", errorRate, threshold: ERROR_THRESHOLD, samples: state.window.length, atStep: STEPS[state.stepIndex] + "%" });
    return;
  }
  // healthy window: advance to the next stage, or finish
  if (state.stepIndex === STEPS.length - 1) {
    state.status = "PROMOTED";
    emit("PROMOTED", { errorRate, samples: state.window.length });
  } else {
    state.stepIndex++;
    state.weight = STEPS[state.stepIndex];
    emit("PROMOTE_STEP", { newWeight: state.weight + "%", errorRate, samples: state.window.length });
  }
  state.window = [];
};

createServer(async (req, res) => {
  if (req.url === "/__deploy") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ...state, window: undefined, events: undefined, recentEvents: state.events.slice(-5) }, null, 2));
    return;
  }
  if (req.method === "POST" && req.url === "/__rollback") {   // manual kill switch for on-call
    state.status = "ROLLED_BACK"; state.weight = 0;
    emit("MANUAL_ROLLBACK", { by: "operator" });
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ status: state.status }));
    return;
  }
  const toCanary = state.status === "PROMOTED" || (state.status === "CANARY" && Math.random() * 100 < state.weight);
  const target = toCanary ? CANARY : STABLE;
  toCanary ? state.counts.canary++ : state.counts.stable++;
  try {
    const r = await fetch(target + req.url, { headers: { "x-trace-id": req.headers["x-trace-id"] ?? randomUUID() }, signal: AbortSignal.timeout(2000) });
    const body = await r.text();
    if (toCanary && state.status === "CANARY") judgeCanary(r.status < 500);
    res.writeHead(r.status, { "Content-Type": r.headers.get("content-type") ?? "application/json", "X-Service-Version": r.headers.get("x-service-version") ?? "?", "X-Trace-Id": r.headers.get("x-trace-id") ?? "" });
    res.end(body);
  } catch (err) {
    if (toCanary && state.status === "CANARY") judgeCanary(false);   // an unreachable canary counts as a failure
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "upstream unreachable" }));
  }
}).listen(PORT, () => console.log(JSON.stringify({ event: "router listening", port: PORT, stable: STABLE, canary: CANARY, steps: STEPS, minSamples: MIN_SAMPLES, errorThreshold: ERROR_THRESHOLD })));
