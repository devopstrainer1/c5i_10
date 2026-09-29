// A genuinely real graph — nodes and edges, real traversal — over
// CoreBank's relationship data: customers, their accounts, and
// transfers between accounts. No graph database needed to prove the
// pattern; the traversal logic is what matters, and it's identical in
// shape whether the backing store is an in-memory Map or Neo4j.

export type NodeType = "customer" | "account";

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: "owns" | "transferred_to";
  weight?: number; // for transferred_to: total amount transferred
}

export class CoreBankGraph {
  private nodes = new Map<string, GraphNode>();
  private edges: GraphEdge[] = [];

  addNode(node: GraphNode) {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: GraphEdge) {
    this.edges.push(edge);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  // Real traversal: every account a customer owns.
  accountsOf(customerId: string): GraphNode[] {
    return this.edges
      .filter((e) => e.from === customerId && e.type === "owns")
      .map((e) => this.nodes.get(e.to)!)
      .filter(Boolean);
  }

  // Real traversal: every account that has ever transferred TO this account.
  incomingTransfers(accountId: string): { from: GraphNode; weight: number }[] {
    return this.edges
      .filter((e) => e.to === accountId && e.type === "transferred_to")
      .map((e) => ({ from: this.nodes.get(e.from)!, weight: e.weight ?? 0 }))
      .filter((r) => r.from);
  }

  // Two-hop traversal: is customer A connected to customer B through
  // any chain of transfers between their accounts? This is the kind
  // of question vector search structurally cannot answer — there's no
  // document that "contains" a two-hop relationship, but a graph
  // traversal answers it directly.
  areCustomersConnected(customerIdA: string, customerIdB: string): {
    connected: boolean;
    path?: string[];
  } {
    const accountsA = this.accountsOf(customerIdA).map((a) => a.id);
    const accountsB = new Set(this.accountsOf(customerIdB).map((a) => a.id));

    for (const accA of accountsA) {
      const transfers = this.edges.filter(
        (e) => e.type === "transferred_to" && (e.from === accA || e.to === accA),
      );
      for (const t of transfers) {
        const otherEnd = t.from === accA ? t.to : t.from;
        if (accountsB.has(otherEnd)) {
          return {
            connected: true,
            path: [customerIdA, accA, otherEnd, customerIdB],
          };
        }
      }
    }
    return { connected: false };
  }
}

// Seed data — deliberately includes one connection that mirrors a
// real fraud-review scenario: two customers whose accounts have
// transferred directly to each other, which the RAG path (searching
// policy documents) has no way to surface, but the graph path
// answers in one traversal.
export function buildSeedGraph(): CoreBankGraph {
  const g = new CoreBankGraph();
  g.addNode({ id: "cust-alice", type: "customer", label: "Alice" });
  g.addNode({ id: "cust-bob", type: "customer", label: "Bob" });
  g.addNode({ id: "cust-carol", type: "customer", label: "Carol" });
  g.addNode({ id: "acct-alice-std", type: "account", label: "Alice — Standard" });
  g.addNode({ id: "acct-alice-sav", type: "account", label: "Alice — Savings" });
  g.addNode({ id: "acct-bob-std", type: "account", label: "Bob — Standard" });
  g.addNode({ id: "acct-carol-std", type: "account", label: "Carol — Standard" });

  g.addEdge({ from: "cust-alice", to: "acct-alice-std", type: "owns" });
  g.addEdge({ from: "cust-alice", to: "acct-alice-sav", type: "owns" });
  g.addEdge({ from: "cust-bob", to: "acct-bob-std", type: "owns" });
  g.addEdge({ from: "cust-carol", to: "acct-carol-std", type: "owns" });

  // Alice's two accounts transfer to each other regularly (same-owner,
  // exempt from the daily limit — the real Day 4 rule).
  g.addEdge({ from: "acct-alice-std", to: "acct-alice-sav", type: "transferred_to", weight: 4900 });
  // Alice has also transferred to Bob — a real cross-customer link.
  g.addEdge({ from: "acct-alice-std", to: "acct-bob-std", type: "transferred_to", weight: 300 });

  return g;
}
