import { readFileSync } from "node:fs";
import { runEval } from "./run-eval.js";

// The merge gate. Two kinds of rule, deliberately different:
//  - ZERO-TOLERANCE: a permission leak is never acceptable, at any size.
//  - TOLERANCE: ranking quality may wobble slightly, but not drop more
//    than TOLERANCE below the recorded baseline.
const TOLERANCE = 0.05;

const baseline = JSON.parse(readFileSync("evals/baseline.json", "utf-8"));
const current = runEval();

const checks = [
  { name: "permission leaks", ok: current.leaks === 0, detail: `${current.leaks} (must be 0)` },
  { name: "hit@1", ok: current.hitAt1 >= baseline.hitAt1 - TOLERANCE, detail: `${current.hitAt1} vs baseline ${baseline.hitAt1}` },
  { name: "recall@3", ok: current.recallAt3 >= baseline.recallAt3 - TOLERANCE, detail: `${current.recallAt3} vs baseline ${baseline.recallAt3}` },
  { name: "MRR", ok: current.mrr >= baseline.mrr - TOLERANCE, detail: `${current.mrr} vs baseline ${baseline.mrr}` },
];

console.log("EVAL GATE");
for (const c of checks) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name.padEnd(18)} ${c.detail}`);

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.log(`\nBLOCKED: ${failed.length} check(s) failed. Merge is not allowed.`);
  for (const p of current.perQuery) {
    if (p.leaked.length) console.log(`  ${p.id}: LEAKED ${p.leaked.join(", ")} to a caller who must not see it`);
    const before = baseline.ranks?.[p.id];
    const worse = !p.leakOnly && before !== undefined && (p.rank === null ? before !== null : before !== null && p.rank > before);
    if (worse) console.log(`  ${p.id}: rank ${before ?? "miss"} -> ${p.rank ?? "miss"}`);
  }
  process.exit(1);
}
console.log("\nOK: no regression against baseline.");
