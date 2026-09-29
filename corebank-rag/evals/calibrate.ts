import { readFileSync } from "node:fs";

// Calibration: before a judge is allowed to gate a merge, measure how often
// it agrees with human labels — and correct for the agreement you'd get by
// chance (Cohen's kappa). Raw accuracy alone flatters a judge on lopsided data.
const KAPPA_REQUIRED = 0.7;

const file = process.argv[2];
if (!file) { console.error("usage: tsx evals/calibrate.ts <judgments.json>"); process.exit(2); }

const human: Record<string, string> = JSON.parse(readFileSync("answer-key/human-labels.json", "utf-8")).labels;
const items = JSON.parse(readFileSync("evals/answer-items.json", "utf-8")).items;
const j = JSON.parse(readFileSync(file, "utf-8"));
const judge: Record<string, string> = j.judgments;

let tp = 0, tn = 0, fp = 0, fn = 0; // positive class = "unfaithful" (the thing we must catch)
const disagreements: string[] = [];
for (const it of items) {
  const h = human[it.id], p = judge[it.id];
  if (h === "unfaithful" && p === "unfaithful") tp++;
  else if (h === "faithful" && p === "faithful") tn++;
  else if (h === "faithful" && p === "unfaithful") { fp++; disagreements.push(`${it.id}  human=faithful   judge=unfaithful   "${it.answer}"`); }
  else { fn++; disagreements.push(`${it.id}  human=unfaithful judge=faithful     "${it.answer}"`); }
}
const n = tp + tn + fp + fn;
const agreement = (tp + tn) / n;
const pe = ((tp + fn) / n) * ((tp + fp) / n) + ((tn + fp) / n) * ((tn + fn) / n);
const kappa = (agreement - pe) / (1 - pe);
const r = (x: number) => Math.round(x * 1000) / 1000;

console.log(`judge: ${j.judge}   items: ${n}`);
console.log(`\n                    judge says unfaithful   judge says faithful`);
console.log(`human: unfaithful          ${String(tp).padStart(3)}                    ${String(fn).padStart(3)}   <- ${fn} hallucination(s) the judge would let through`);
console.log(`human: faithful            ${String(fp).padStart(3)}                    ${String(tn).padStart(3)}   <- ${fp} good answer(s) the judge would wrongly block`);
console.log(`\nraw agreement: ${r(agreement)}   Cohen's kappa: ${r(kappa)}   (required: ${KAPPA_REQUIRED})`);
if (disagreements.length) { console.log("\ndisagreements:"); disagreements.forEach((d) => console.log("  " + d)); }

if (kappa < KAPPA_REQUIRED) {
  console.log(`\nJUDGE NOT APPROVED: kappa ${r(kappa)} < ${KAPPA_REQUIRED}. Do not use this judge to gate merges.`);
  process.exit(1);
}
console.log(`\nJUDGE APPROVED for gating (kappa ${r(kappa)} >= ${KAPPA_REQUIRED}).`);
