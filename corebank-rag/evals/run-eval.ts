import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { retrieve, type UserTier } from "../src/retrieval/retrieval-endpoint.js";

interface EvalQuery {
  id: string;
  query: string;
  tier: UserTier;
  relevant: string[];
  mustNotReturn?: string[];
}

export interface EvalReport {
  queriesScored: number;
  hitAt1: number;
  recallAt3: number;
  mrr: number;
  leaks: number;
  perQuery: { id: string; rank: number | null; top3: string[]; leaked: string[]; leakOnly: boolean }[];
}

export function runEval(): EvalReport {
  const set = JSON.parse(readFileSync("evals/retrieval-eval-set.json", "utf-8"));
  const queries: EvalQuery[] = set.queries;

  let scored = 0, hit1 = 0, rec3 = 0, rrSum = 0, leaks = 0;
  const perQuery: EvalReport["perQuery"] = [];

  for (const q of queries) {
    const res = retrieve({ query: q.query, userTier: q.tier, pageSize: 10 });
    const ids = res.results.map((r) => r.id);

    const leaked = (q.mustNotReturn ?? []).filter((d) => ids.includes(d));
    leaks += leaked.length;

    let rank: number | null = null;
    if (q.relevant.length > 0) {
      scored++;
      const firstHit = ids.findIndex((id) => q.relevant.includes(id));
      rank = firstHit === -1 ? null : firstHit + 1;
      if (rank === 1) hit1++;
      if (rank !== null && rank <= 3) rec3++;
      if (rank !== null) rrSum += 1 / rank;
    }
    perQuery.push({ id: q.id, rank, top3: ids.slice(0, 3), leaked, leakOnly: q.relevant.length === 0 });
  }

  const r = (n: number) => Math.round(n * 1000) / 1000;
  return {
    queriesScored: scored,
    hitAt1: r(hit1 / scored),
    recallAt3: r(rec3 / scored),
    mrr: r(rrSum / scored),
    leaks,
    perQuery,
  };
}

// --- CLI ---------------------------------------------------------
const isMain = process.argv[1]?.endsWith("run-eval.ts");
if (isMain) {
  const report = runEval();
  console.log(`queries scored: ${report.queriesScored}`);
  console.log(`hit@1: ${report.hitAt1}   recall@3: ${report.recallAt3}   MRR: ${report.mrr}   permission leaks: ${report.leaks}`);
  console.log("\nper-query:");
  for (const p of report.perQuery) {
    const status = p.leaked.length ? `LEAK ${p.leaked}` : p.rank !== null ? `rank ${p.rank}` : p.leakOnly ? "no leak" : "MISS";
    console.log(`  ${p.id}  ${status.padEnd(10)} top3=${p.top3.join(",")}`);
  }
  if (process.argv.includes("--write-baseline")) {
    const { perQuery, ...metrics } = report;
    const ranks = Object.fromEntries(perQuery.filter((p) => !p.leakOnly).map((p) => [p.id, p.rank]));
    writeFileSync("evals/baseline.json", JSON.stringify({ ...metrics, ranks }, null, 2) + "\n");
    console.log("\nbaseline written to evals/baseline.json");
  }
  if (!existsSync("evals/baseline.json")) console.log("\n(no baseline yet)");
}
