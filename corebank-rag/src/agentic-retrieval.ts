import { retrieve, type UserTier } from "./retrieval/retrieval-endpoint.js";

// Single-shot RAG: one query in, whatever comes back is what the
// model answers from — even if it's thin or off-target.
//
// Agentic retrieval: the retrieval step itself is a loop. After each
// search, something evaluates whether the results are actually good
// enough to answer the question — and if not, reformulates the query
// and searches again, up to a bound. This is Day 6's agent loop
// (plan -> act -> observe -> decide) applied specifically to search.
//
// The "evaluate and reformulate" step would normally be an LLM call.
// It's a deterministic stub here for the same reason as Day 6's
// stub-client: no live API key in this sandbox, but the loop's
// control flow — the iteration cap, the stopping condition — is
// exactly what a real implementation uses, and it's fully tested here.

export interface AgenticSearchResult {
  finalResults: ReturnType<typeof retrieve>["results"];
  queriesTried: string[];
  stopReason: "sufficient_results" | "max_iterations_reached";
}

interface Evaluator {
  // Returns true if results are good enough to stop, plus a
  // reformulated query to try next if not.
  evaluate(query: string, results: ReturnType<typeof retrieve>["results"]): {
    sufficient: boolean;
    reformulatedQuery?: string;
  };
}

// A real, simple evaluator: "sufficient" means at least one result
// scored above a threshold. A production evaluator would use an LLM
// to actually judge relevance, not just a score cutoff.
export class ScoreThresholdEvaluator implements Evaluator {
  constructor(private threshold: number) {}
  evaluate(query: string, results: ReturnType<typeof retrieve>["results"]) {
    const best = results[0]?.score ?? 0;
    if (best >= this.threshold) return { sufficient: true };
    // Deterministic, simple reformulation strategy: broaden by
    // dropping the last word (approximates "the query was too
    // specific, try a broader version").
    const words = query.split(" ");
    const reformulated = words.slice(0, -1).join(" ") || query;
    return { sufficient: false, reformulatedQuery: reformulated };
  }
}

export function agenticSearch(
  initialQuery: string,
  userTier: UserTier,
  evaluator: Evaluator,
  maxIterations = 3,
): AgenticSearchResult {
  let query = initialQuery;
  const queriesTried: string[] = [];

  for (let i = 0; i < maxIterations; i++) {
    queriesTried.push(query);
    const response = retrieve({ query, userTier, pageSize: 5 });
    const { sufficient, reformulatedQuery } = evaluator.evaluate(query, response.results);

    if (sufficient || !reformulatedQuery || reformulatedQuery === query) {
      return {
        finalResults: response.results,
        queriesTried,
        stopReason: "sufficient_results",
      };
    }
    query = reformulatedQuery;
  }

  // Iteration cap hit — same shape as Day 6's maxTurns. Return
  // whatever the last attempt found rather than nothing.
  const lastResponse = retrieve({ query, userTier, pageSize: 5 });
  return {
    finalResults: lastResponse.results,
    queriesTried,
    stopReason: "max_iterations_reached",
  };
}
