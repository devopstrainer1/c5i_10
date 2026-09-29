import type { Document } from "../data/documents.js";

// A real, standard BM25 implementation — the sparse/keyword half of
// hybrid search. No external library, no network call: this is
// genuinely running, not simulated.
const K1 = 1.5;
const B = 0.75;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export interface ScoredDoc {
  doc: Document;
  score: number;
}

export class BM25Index {
  private docs: Document[];
  private docTokens: string[][];
  private avgDocLength: number;
  private docFreq = new Map<string, number>(); // how many docs contain term t

  constructor(docs: Document[]) {
    this.docs = docs;
    this.docTokens = docs.map((d) => tokenize(`${d.title} ${d.text}`));
    this.avgDocLength =
      this.docTokens.reduce((sum, t) => sum + t.length, 0) / this.docTokens.length;

    for (const tokens of this.docTokens) {
      const seen = new Set(tokens);
      for (const term of seen) {
        this.docFreq.set(term, (this.docFreq.get(term) ?? 0) + 1);
      }
    }
  }

  private idf(term: string): number {
    const n = this.docs.length;
    const df = this.docFreq.get(term) ?? 0;
    // Standard BM25 IDF with a floor so an unseen term contributes ~0,
    // not a negative score.
    return Math.max(0, Math.log((n - df + 0.5) / (df + 0.5) + 1));
  }

  search(query: string, topK = 5): ScoredDoc[] {
    const queryTerms = tokenize(query);
    const scores = this.docs.map((doc, i) => {
      const tokens = this.docTokens[i];
      const docLength = tokens.length;
      let score = 0;
      for (const term of queryTerms) {
        const tf = tokens.filter((t) => t === term).length;
        if (tf === 0) continue;
        const idf = this.idf(term);
        const numerator = tf * (K1 + 1);
        const denominator = tf + K1 * (1 - B + B * (docLength / this.avgDocLength));
        score += idf * (numerator / denominator);
      }
      return { doc, score };
    });
    return scores
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
