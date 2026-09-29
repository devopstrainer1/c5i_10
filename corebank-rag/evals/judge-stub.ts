import { readFileSync, writeFileSync } from "node:fs";
import { documents } from "../src/data/documents.js";

// A DETERMINISTIC STAND-IN for an LLM judge. It is NOT a good judge and is
// not meant to be: it exists so the calibration machinery below can be run
// and understood without an API key. It checks two shallow things —
//   1. any number in the answer that is absent from the source text
//   2. how much of the answer's vocabulary appears in the source text
// It cannot understand meaning, so it cannot tell "exempt" from "not exempt".
const items = JSON.parse(readFileSync("evals/answer-items.json", "utf-8")).items;
const words = (s: string) => s.toLowerCase().match(/[a-z]+/g) ?? [];
const nums = (s: string) => s.match(/\d[\d,]*/g)?.map((n) => n.replace(/,/g, "")) ?? [];
const STOP = new Set("a an the of to and or is are be can it its on in at for with by as up no not yes".split(" "));

const judgments: Record<string, string> = {};
for (const it of items) {
  const ctx = documents.find((d) => d.id === it.docId)!.text;
  const ctxNums = new Set(nums(ctx));
  const novelNumber = nums(it.answer).some((n) => !ctxNums.has(n));
  const ansWords = words(it.answer).filter((w) => !STOP.has(w));
  const ctxWords = new Set(words(ctx));
  const coverage = ansWords.length ? ansWords.filter((w) => ctxWords.has(w)).length / ansWords.length : 0;
  judgments[it.id] = novelNumber || coverage < 0.6 ? "unfaithful" : "faithful";
}
writeFileSync("evals/judgments.stub.json", JSON.stringify({ judge: "stub-heuristic", judgments }, null, 2));
console.log("wrote evals/judgments.stub.json");
