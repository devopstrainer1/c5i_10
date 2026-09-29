import type { Document } from "../data/documents.js";

// IMPORTANT — read before teaching from this file:
//
// This is NOT a real semantic embedding model. Generating genuine
// embeddings requires calling a real model (OpenAI, Voyage, Cohere,
// or a locally-hosted one) — this sandbox has no network access to
// download model weights, so a live call wasn't possible here.
//
// What's below is a deterministic TF-IDF vector + cosine similarity,
// used ONLY as a stand-in so the surrounding retrieval architecture —
// fusion, reranking, permission filtering, routing — can be built and
// genuinely tested end to end. It captures term overlap, not meaning:
// it cannot tell "the account is frozen" and "the account is locked"
// are related. A real embedding model can.
//
// To make this production-real: replace `embed()` below with a call
// to a real embeddings endpoint. Nothing else in this codebase needs
// to change — every consumer of this file only depends on the
// `search(query, topK)` shape, not on how the vector was produced.

export interface ScoredDoc {
  doc: Document;
  score: number;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [term, weight] of a) {
    if (b.has(term)) dot += weight * b.get(term)!;
  }
  const magA = Math.sqrt([...a.values()].reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt([...b.values()].reduce((s, v) => s + v * v, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

export class DenseIndexStandIn {
  private docs: Document[];
  private docVectors: Map<string, number>[];
  private idf = new Map<string, number>();

  constructor(docs: Document[]) {
    this.docs = docs;
    const allTokens = docs.map((d) => tokenize(`${d.title} ${d.text}`));

    const df = new Map<string, number>();
    for (const tokens of allTokens) {
      for (const term of new Set(tokens)) {
        df.set(term, (df.get(term) ?? 0) + 1);
      }
    }
    for (const [term, count] of df) {
      this.idf.set(term, Math.log(docs.length / count));
    }

    this.docVectors = allTokens.map((tokens) => this.vectorize(tokens));
  }

  private vectorize(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    const vec = new Map<string, number>();
    for (const [term, count] of tf) {
      vec.set(term, count * (this.idf.get(term) ?? 0));
    }
    return vec;
  }

  // Stand-in for `await embeddingClient.embed(query)`.
  private embed(text: string): Map<string, number> {
    return this.vectorize(tokenize(text));
  }

  search(query: string, topK = 5): ScoredDoc[] {
    const queryVec = this.embed(query);
    const scores = this.docs.map((doc, i) => ({
      doc,
      score: cosineSimilarity(queryVec, this.docVectors[i]),
    }));
    return scores
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
