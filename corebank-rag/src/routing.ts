// A real, testable routing heuristic. Production systems often use a
// small classifier or an LLM call for this decision; a rule-based
// router is shown here because the ROUTING LOGIC — what signals imply
// "this needs relationship traversal, not document search" — is the
// actual teaching point, and it's identical whether a human wrote the
// rules or a model did.

export type RetrievalPath = "rag" | "graph" | "both";

const RELATIONSHIP_SIGNALS = [
  "connected", "related", "linked", "transferred to", "transferred from",
  "between", "shared", "same owner", "who sent", "who received",
];

const POLICY_SIGNALS = [
  "policy", "rule", "limit", "fee", "interest", "requirement",
  "procedure", "allowed", "how much", "what is",
];

export function routeQuery(query: string): RetrievalPath {
  const normalized = query.toLowerCase();
  const hasRelationshipSignal = RELATIONSHIP_SIGNALS.some((s) => normalized.includes(s));
  const hasPolicySignal = POLICY_SIGNALS.some((s) => normalized.includes(s));

  if (hasRelationshipSignal && hasPolicySignal) return "both";
  if (hasRelationshipSignal) return "graph";
  return "rag"; // default — most queries are policy/document questions
}
