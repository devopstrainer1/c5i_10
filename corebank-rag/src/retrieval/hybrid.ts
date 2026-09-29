import { BM25Index } from "./bm25.js";
import { DenseIndexStandIn } from "./dense-standin.js";
import type { Document } from "../data/documents.js";

// Reciprocal Rank Fusion — a real, standard hybrid-retrieval technique.
// Each ranker's opinion is reduced to 1/(k + rank) and summed, so a
// document that ranks highly in EITHER list scores well, and one that
// ranks highly in BOTH scores best of all. This is what makes hybrid
// search more robust than either ranker alone: BM25 catches exact
// terms a paraphrase-friendly dense model might miss ("KYC"), and
// dense retrieval catches conceptual matches BM25's exact-term
// matching misses.
const RRF_K = 60; // standard default from the original RRF paper

export interface HybridResult {
  doc: Document;
  fusedScore: number;
  bm25Rank?: number;
  denseRank?: number;
}

export class HybridIndex {
  private bm25: BM25Index;
  private dense: DenseIndexStandIn;

  constructor(docs: Document[]) {
    this.bm25 = new BM25Index(docs);
    this.dense = new DenseIndexStandIn(docs);
  }

  search(query: string, topK = 5): HybridResult[] {
    const bm25Results = this.bm25.search(query, 20);
    const denseResults = this.dense.search(query, 20);

    const fused = new Map<string, HybridResult>();

    bm25Results.forEach((r, rank) => {
      fused.set(r.doc.id, {
        doc: r.doc,
        fusedScore: 1 / (RRF_K + rank + 1),
        bm25Rank: rank + 1,
      });
    });

    denseResults.forEach((r, rank) => {
      const existing = fused.get(r.doc.id);
      const contribution = 1 / (RRF_K + rank + 1);
      if (existing) {
        existing.fusedScore += contribution;
        existing.denseRank = rank + 1;
      } else {
        fused.set(r.doc.id, { doc: r.doc, fusedScore: contribution, denseRank: rank + 1 });
      }
    });

    return [...fused.values()].sort((a, b) => b.fusedScore - a.fusedScore).slice(0, topK);
  }
}
