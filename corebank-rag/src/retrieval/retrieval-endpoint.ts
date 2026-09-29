import { HybridIndex, type HybridResult } from "./hybrid.js";
import { rerank } from "./rerank.js";
import { documents, type Document } from "../data/documents.js";

export type UserTier = "public" | "internal" | "compliance";

// A user's tier determines which document tiers they can see. This
// mirrors CoreBank's actual account-tier logic from Day 4 — the same
// "least privilege by default" principle, applied to documents
// instead of accounts.
const TIER_ACCESS: Record<UserTier, Document["tier"][]> = {
  public: ["public"],
  internal: ["public", "internal"],
  compliance: ["public", "internal", "compliance"],
};

export interface RetrievalRequest {
  query: string;
  userTier: UserTier;
  page?: number;
  pageSize?: number;
}

export interface RetrievalResponse {
  results: { id: string; title: string; snippet: string; score: number }[];
  page: number;
  pageSize: number;
  totalMatches: number;
  cached: boolean;
}

const index = new HybridIndex(documents);

// A simple in-memory cache, keyed by query + tier (never cache across
// tiers — a compliance-tier cache entry leaking into a public-tier
// response would be a real access-control bug, not just a performance
// quirk). A production cache would use Redis with a TTL; this proves
// the caching *logic* — what to key on, when a cache entry is unsafe
// to reuse — independent of which store backs it.
const cache = new Map<string, HybridResult[]>();

function cacheKey(query: string, userTier: UserTier): string {
  return `${userTier}::${query.toLowerCase().trim()}`;
}

export function retrieve(req: RetrievalRequest): RetrievalResponse {
  const page = req.page ?? 1;
  const pageSize = req.pageSize ?? 3;
  const key = cacheKey(req.query, req.userTier);

  let fused: HybridResult[];
  let cached = false;

  if (cache.has(key)) {
    fused = cache.get(key)!;
    cached = true;
  } else {
    const hybridResults = index.search(req.query, 20);
    fused = rerank(req.query, hybridResults);
    cache.set(key, fused);
  }

  // Permission filter — applied AFTER retrieval and reranking, not
  // baked into the index itself. This keeps the index tier-agnostic
  // and reusable; the alternative (a separate index per tier) doesn't
  // scale past a handful of tiers.
  const allowedTiers = TIER_ACCESS[req.userTier];
  const filtered = fused.filter((r) => allowedTiers.includes(r.doc.tier));

  const start = (page - 1) * pageSize;
  const pageResults = filtered.slice(start, start + pageSize);

  return {
    results: pageResults.map((r) => ({
      id: r.doc.id,
      title: r.doc.title,
      snippet: r.doc.text.slice(0, 140) + "...",
      score: Math.round(r.fusedScore * 1000) / 1000,
    })),
    page,
    pageSize,
    totalMatches: filtered.length,
    cached,
  };
}
