// ANSWER KEY for the mutation-triage lab. Each test below exists to kill one
// specific surviving mutant from the "real" suite. Do not hand this file out
// before learners have triaged the survivors themselves.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { transfer } from "../src/services/transferService.js";
import { store } from "../src/store.js";
import { resetStore, fundedAccount } from "../tests/helpers.js";

describe("transfer (killers)", () => {
  beforeEach(resetStore);
  afterEach(() => vi.useRealTimers());

  // kills: dayKey `.slice(0, 10)` removed (limit would reset every millisecond)
  it("counts two transfers a millisecond apart toward the same day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T12:00:00.000Z"));
    const a = fundedAccount("alice", "standard", 10000);
    const b = fundedAccount("bob", "standard", 0);
    expect(transfer(a.id, b.id, 3000, "x").ok).toBe(true);
    vi.setSystemTime(new Date("2026-03-10T12:00:00.001Z"));
    expect(transfer(a.id, b.id, 1501, "x").ok).toBe(false);
  });
  it("resets the daily total on the next calendar day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T12:00:00Z"));
    const a = fundedAccount("alice", "standard", 20000);
    const b = fundedAccount("bob", "standard", 0);
    expect(transfer(a.id, b.id, 4500, "x").ok).toBe(true);
    expect(transfer(a.id, b.id, 1, "x").ok).toBe(false);
    vi.setSystemTime(new Date("2026-03-11T00:00:01Z"));
    expect(transfer(a.id, b.id, 4500, "x").ok).toBe(true);
  });

  // kills: dayKey body emptied / key replaced by "" (all senders share one bucket)
  it("tracks each sender's daily total separately", () => {
    const a = fundedAccount("alice", "standard", 10000);
    const b = fundedAccount("bob", "standard", 0);
    const c = fundedAccount("carol", "standard", 10000);
    const d = fundedAccount("dave", "standard", 0);
    expect(transfer(a.id, b.id, 3000, "x").ok).toBe(true);
    expect(transfer(c.id, d.id, 3000, "x").ok).toBe(true);
  });

  // kills: `!from || !to` weakened to `!from && !to`
  it("rejects when only ONE of the two accounts is missing", () => {
    const a = fundedAccount("alice", "standard", 100);
    expect(transfer(a.id, "missing", 1, "x")).toEqual({ ok: false, error: "Account not found" });
    expect(transfer("missing", a.id, 1, "x")).toEqual({ ok: false, error: "Account not found" });
  });

  // kills: `ok: false` flipped to `ok: true` on the two rejection paths
  it("returns ok:false — not just an error string — when rejecting", () => {
    const a = fundedAccount("alice", "standard", 100);
    const b = fundedAccount("bob", "standard", 0);
    expect(transfer(a.id, b.id, 0, "x")).toEqual({ ok: false, error: "Amount must be positive" });
    expect(transfer(a.id, b.id, 101, "x")).toEqual({ ok: false, error: "Insufficient funds" });
  });

  // kills: transaction `type` strings blanked
  it("records the right transaction type on each side", () => {
    const a = fundedAccount("alice", "standard", 100);
    const b = fundedAccount("bob", "standard", 0);
    transfer(a.id, b.id, 10, "x");
    const out = store.transactions.find((t) => t.accountId === a.id)!;
    const inn = store.transactions.find((t) => t.accountId === b.id)!;
    expect(out.type).toBe("transfer_out");
    expect(inn.type).toBe("transfer_in");
  });
});
