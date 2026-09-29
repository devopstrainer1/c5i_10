import { readFileSync } from "node:fs";

// Per-request cost ESTIMATE. Same lesson as Day 6's total_cost_usd: this is
// an estimate built from call counts and token approximations — useful for
// trends and for catching a cost regression, never an invoice.
const rates = JSON.parse(readFileSync(new URL("../ops/cost-rates.json", import.meta.url), "utf-8"));
const tokens = (chars: number) => Math.ceil(chars / 4); // rough: ~4 characters per token

export interface CostInput {
  cached: boolean;        // a cache hit skips the embedding and rerank calls
  queryChars: number;
  contextChars: number;   // text that would be sent to the LLM to write an answer
}

export function estimateRequestCost({ cached, queryChars, contextChars }: CostInput) {
  const embed = cached ? 0 : (tokens(queryChars) / 1e6) * rates.embeddingPerMillionTokens;
  const rerank = cached ? 0 : (1 / 1000) * rates.rerankPerThousandSearches;
  const llm =
    (tokens(contextChars + queryChars) / 1e6) * rates.llmInputPerMillionTokens +
    (rates.assumedAnswerOutputTokens / 1e6) * rates.llmOutputPerMillionTokens;
  const total = embed + rerank + llm;
  return { embed, rerank, llm, total };
}
