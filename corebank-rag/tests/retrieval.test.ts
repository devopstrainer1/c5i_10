import { describe, it, expect } from "vitest";
import { retrieve } from "../src/retrieval/retrieval-endpoint.js";
import { buildSeedGraph } from "../src/graph/graph.js";
import { routeQuery } from "../src/routing.js";
import { agenticSearch, ScoreThresholdEvaluator } from "../src/agentic-retrieval.js";

describe("hybrid retrieval endpoint", () => {
  it("finds the daily transfer limit doc for a limit-related query", () => {
    const res = retrieve({ query: "what is the daily transfer limit", userTier: "public" });
    expect(res.results[0].id).toBe("doc-2");
  });

  it("distinguishes overdraft policy from transfer limits despite vocabulary overlap", () => {
    const res = retrieve({ query: "premium account overdraft policy", userTier: "internal" });
    expect(res.results[0].id).toBe("doc-3");
  });

  it("enforces tier-based permission filtering — public users never see compliance docs", () => {
    const res = retrieve({ query: "fraud account freeze", userTier: "public" });
    const ids = res.results.map((r) => r.id);
    expect(ids).not.toContain("doc-6"); // doc-6 is compliance-tier
  });

  it("allows compliance-tier users to see compliance docs", () => {
    const res = retrieve({ query: "fraud account freeze", userTier: "compliance" });
    const ids = res.results.map((r) => r.id);
    expect(ids).toContain("doc-6");
  });

  it("paginates results correctly", () => {
    const page1 = retrieve({ query: "account", userTier: "compliance", page: 1, pageSize: 2 });
    const page2 = retrieve({ query: "account", userTier: "compliance", page: 2, pageSize: 2 });
    expect(page1.results.length).toBe(2);
    expect(page1.results[0].id).not.toBe(page2.results[0]?.id);
  });

  it("reports cache hits on a repeated identical query", () => {
    const first = retrieve({ query: "unique-cache-test-query fee schedule", userTier: "public" });
    const second = retrieve({ query: "unique-cache-test-query fee schedule", userTier: "public" });
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
  });

  it("does NOT leak a compliance-tier cache entry into a public-tier request", () => {
    retrieve({ query: "cache-isolation-test fraud", userTier: "compliance" });
    const publicResult = retrieve({ query: "cache-isolation-test fraud", userTier: "public" });
    const ids = publicResult.results.map((r) => r.id);
    expect(ids).not.toContain("doc-6");
  });
});

describe("CoreBank graph — GraphRAG path", () => {
  const graph = buildSeedGraph();

  it("finds all accounts owned by a customer", () => {
    const accounts = graph.accountsOf("cust-alice");
    expect(accounts.map((a) => a.id).sort()).toEqual(["acct-alice-sav", "acct-alice-std"]);
  });

  it("answers a two-hop relationship question vector search cannot", () => {
    const result = graph.areCustomersConnected("cust-alice", "cust-bob");
    expect(result.connected).toBe(true);
    expect(result.path).toContain("acct-alice-std");
    expect(result.path).toContain("acct-bob-std");
  });

  it("correctly reports customers with NO connection", () => {
    const result = graph.areCustomersConnected("cust-bob", "cust-carol");
    expect(result.connected).toBe(false);
  });
});

describe("query router", () => {
  it("routes a policy question to RAG", () => {
    expect(routeQuery("What is the overdraft limit for premium accounts?")).toBe("rag");
  });

  it("routes a relationship question to the graph", () => {
    expect(routeQuery("Is Alice's account connected to Bob's account?")).toBe("graph");
  });

  it("routes a mixed question to both", () => {
    expect(routeQuery("What is the policy when two related accounts transfer to each other?")).toBe("both");
  });
});

describe("agentic retrieval", () => {
  it("stops early when the first query already scores above threshold", () => {
    const result = agenticSearch(
      "daily transfer limit policy",
      "public",
      new ScoreThresholdEvaluator(0.01),
    );
    expect(result.stopReason).toBe("sufficient_results");
    expect(result.queriesTried.length).toBe(1);
  });

  it("actually reformulates and retries when results are weak, and respects the iteration cap", () => {
    const result = agenticSearch(
      "completely unrelated nonexistent banking topic xyz",
      "public",
      new ScoreThresholdEvaluator(0.99), // impossible threshold — forces max iterations
      3,
    );
    expect(result.stopReason).toBe("max_iterations_reached");
    expect(result.queriesTried.length).toBe(3);
    // Confirm it genuinely reformulated — later queries should be
    // shorter than the first (words dropped each iteration).
    expect(result.queriesTried[2].length).toBeLessThan(result.queriesTried[0].length);
  });
});
