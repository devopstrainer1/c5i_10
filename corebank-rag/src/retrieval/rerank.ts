import type { HybridResult } from "./hybrid.js";

// IMPORTANT — same caveat as dense-standin.ts:
//
// A real reranking stage calls a cross-encoder model (Cohere Rerank,
// Voyage rerank, or similar) that jointly reads the query and each
// candidate document together, which is strictly more accurate than
// scoring them separately the way BM25 and the dense stand-in both
// do. That requires a live API call this sandbox can't make.
//
// What's below is a real, testable heuristic stand-in: it boosts
// documents containing an exact phrase from the query (not just the
// individual terms), which approximates one thing a cross-encoder is
// good at — recognizing that "daily transfer limit" as a phrase
// matters more than "daily," "transfer," and "limit" appearing
// separately, possibly in unrelated sentences.
//
// To make this production-real: replace `phraseBoost()` below with a
// call to a real rerank endpoint, passing the query and each
// candidate's text. The calling code (retrieval-endpoint.ts) doesn't
// need to change — it only depends on rerank() returning results in
// a new order.

function phraseBoost(query: string, text: string): number {
  const normalizedQuery = query.toLowerCase();
  const normalizedText = text.toLowerCase();

  let boost = 0;
  // Exact full-query phrase match — strongest signal.
  if (normalizedText.includes(normalizedQuery)) {
    boost += 1.0;
  }
  // Bigram overlap — catches partial phrase matches like
  // "transfer limit" inside a longer query.
  const queryWords = normalizedQuery.match(/[a-z0-9]+/g) ?? [];
  for (let i = 0; i < queryWords.length - 1; i++) {
    const bigram = `${queryWords[i]} ${queryWords[i + 1]}`;
    if (normalizedText.includes(bigram)) {
      boost += 0.15;
    }
  }
  return boost;
}

export function rerank(query: string, results: HybridResult[]): HybridResult[] {
  return results
    .map((r) => ({
      ...r,
      fusedScore: r.fusedScore + phraseBoost(query, `${r.doc.title} ${r.doc.text}`),
    }))
    .sort((a, b) => b.fusedScore - a.fusedScore);
}
