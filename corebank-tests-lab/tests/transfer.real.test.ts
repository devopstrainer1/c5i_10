// REAL CHARACTERISATION TESTS: each one pins down a specific behaviour with
// an assertion that would fail if that behaviour changed. Includes the two
// Day 4 quirks, asserted as they are TODAY (the $4,500 hardcode).
import { describe, it, expect, beforeEach } from "vitest";
import { transfer } from "../src/services/transferService.js";
import { setFrozen, getAccount } from "../src/services/accountService.js";
import { store } from "../src/store.js";
import { resetStore, fundedAccount } from "./helpers.js";

describe("transfer (real)", () => {
  beforeEach(resetStore);

  it("moves money and records both sides", () => {
    const a = fundedAccount("alice", "standard", 1000);
    const b = fundedAccount("bob", "standard", 0);
    expect(transfer(a.id, b.id, 100, "rent")).toEqual({ ok: true });
    expect(getAccount(a.id)!.balance).toBe(900);
    expect(getAccount(b.id)!.balance).toBe(100);
    expect(store.transactions).toHaveLength(2);
    expect(store.transactions.map((t) => t.amount).sort((x, y) => x - y)).toEqual([-100, 100]);
  });
  it("rejects an unknown account", () => {
    expect(transfer("nope", "nada", 10, "x")).toEqual({ ok: false, error: "Account not found" });
  });
  it("rejects a frozen source or destination", () => {
    const a = fundedAccount("alice", "standard", 1000);
    const b = fundedAccount("bob", "standard", 0);
    setFrozen(b.id, true);
    expect(transfer(a.id, b.id, 10, "x")).toEqual({ ok: false, error: "Account is frozen" });
    expect(getAccount(a.id)!.balance).toBe(1000);
  });
  it("rejects zero and negative amounts", () => {
    const a = fundedAccount("alice", "standard", 1000);
    const b = fundedAccount("bob", "standard", 0);
    expect(transfer(a.id, b.id, 0, "x").error).toBe("Amount must be positive");
    expect(transfer(a.id, b.id, -5, "x").error).toBe("Amount must be positive");
  });
  it("allows exactly 4500 cross-owner in a day (boundary)", () => {
    const a = fundedAccount("alice", "standard", 10000);
    const b = fundedAccount("bob", "standard", 0);
    expect(transfer(a.id, b.id, 4500, "x").ok).toBe(true);
  });
  it("blocks 4501 cross-owner — the real limit is 4500, not the 5000 in the message", () => {
    const a = fundedAccount("alice", "standard", 10000);
    const b = fundedAccount("bob", "standard", 0);
    const r = transfer(a.id, b.id, 4501, "x");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Daily transfer limit");
  });
  it("accumulates the daily total across transfers", () => {
    const a = fundedAccount("alice", "standard", 10000);
    const b = fundedAccount("bob", "standard", 0);
    expect(transfer(a.id, b.id, 3000, "x").ok).toBe(true);
    expect(transfer(a.id, b.id, 1501, "x").ok).toBe(false);
    expect(transfer(a.id, b.id, 1500, "x").ok).toBe(true);
  });
  it("exempts same-owner transfers from the daily limit", () => {
    const a = fundedAccount("alice", "standard", 10000);
    const b = fundedAccount("alice", "savings", 0);
    expect(transfer(a.id, b.id, 9000, "x").ok).toBe(true);
    expect(store.dailyTransferTotals.size).toBe(0);
  });
  it("blocks a transfer that would go below the minimum balance", () => {
    const a = fundedAccount("alice", "standard", 100);
    const b = fundedAccount("alice", "savings", 0);
    expect(transfer(a.id, b.id, 101, "x").error).toBe("Insufficient funds");
    expect(transfer(a.id, b.id, 100, "x").ok).toBe(true);
  });
  it("lets a premium account overdraw to exactly -5000 but no further", () => {
    const a = fundedAccount("alice", "premium", 0);
    const b = fundedAccount("alice", "savings", 0);
    expect(transfer(a.id, b.id, 5001, "x").error).toBe("Insufficient funds");
    expect(transfer(a.id, b.id, 5000, "x").ok).toBe(true);
    expect(getAccount(a.id)!.balance).toBe(-5000);
  });
  it("categorises the transaction description", () => {
    const a = fundedAccount("alice", "standard", 1000);
    const b = fundedAccount("alice", "savings", 0);
    transfer(a.id, b.id, 10, "UBER trip");
    expect(store.transactions.every((t) => t.category === "Transport")).toBe(true);
  });
  it("does not change any balance when a transfer is rejected", () => {
    const a = fundedAccount("alice", "standard", 50);
    const b = fundedAccount("bob", "standard", 0);
    transfer(a.id, b.id, 4600, "x");
    expect(getAccount(a.id)!.balance).toBe(50);
    expect(getAccount(b.id)!.balance).toBe(0);
  });
});
