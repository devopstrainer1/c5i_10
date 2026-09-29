import { retrieve } from "../src/retrieval/retrieval-endpoint.js";
import { BM25Index } from "../src/retrieval/bm25.js";
import { documents } from "../src/data/documents.js";
import { buildSeedGraph } from "../src/graph/graph.js";
import { routeQuery } from "../src/routing.js";
import { agenticSearch, ScoreThresholdEvaluator } from "../src/agentic-retrieval.js";

console.log("=".repeat(70));
console.log("1. NAIVE (single-shot, keyword-only) — query: 'overdraft'");
console.log("=".repeat(70));
const bm25 = new BM25Index(documents);
console.log(bm25.search("overdraft", 3).map((r) => `${r.doc.id}: ${r.doc.title} (score ${r.score.toFixed(2)})`));

console.log("\n" + "=".repeat(70));
console.log("2. HYBRID (BM25 + dense fusion + rerank) — same query: 'overdraft'");
console.log("=".repeat(70));
const hybrid = retrieve({ query: "overdraft", userTier: "internal" });
console.log(hybrid.results.map((r) => `${r.id}: ${r.title} (score ${r.score})`));

console.log("\n" + "=".repeat(70));
console.log("3. GraphRAG — a question hybrid search structurally cannot answer");
console.log("=".repeat(70));
const graph = buildSeedGraph();
const connection = graph.areCustomersConnected("cust-alice", "cust-bob");
console.log("Query: 'Is Alice connected to Bob through any transfers?'");
console.log("Graph traversal result:", connection);
console.log("(No document in the corpus 'contains' this fact — it only exists as a graph edge.)");

console.log("\n" + "=".repeat(70));
console.log("4. ROUTING — deciding which path a query actually needs");
console.log("=".repeat(70));
const testQueries = [
  "What is the daily transfer limit?",
  "Is Alice's account related to Bob's account?",
  "What is the policy when related accounts transfer to each other?",
];
for (const q of testQueries) {
  console.log(`"${q}" -> ${routeQuery(q)}`);
}

console.log("\n" + "=".repeat(70));
console.log("5. AGENTIC retrieval — a query that needs reformulation to succeed");
console.log("=".repeat(70));
const agenticResult = agenticSearch(
  "money rules maximum amount per day for sending",  // deliberately awkward, longer phrasing
  "public",
  new ScoreThresholdEvaluator(0.05),
  3,
);
console.log("Queries actually tried, in order:", agenticResult.queriesTried);
console.log("Stop reason:", agenticResult.stopReason);
console.log("Final top result:", agenticResult.finalResults[0]);
