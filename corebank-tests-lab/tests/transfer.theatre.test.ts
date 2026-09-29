// COVERAGE THEATRE: every branch of transfer() is executed, so a coverage
// tool reports a very high number. But nearly every assertion is
// "something came back" — so almost any bug would still pass.
import { describe, it, expect, beforeEach } from "vitest";
import { transfer } from "../src/services/transferService.js";
import { setFrozen } from "../src/services/accountService.js";
import { resetStore, fundedAccount } from "./helpers.js";

describe("transfer (theatre)", () => {
  beforeEach(resetStore);

  it("runs the happy path", () => {
    const a = fundedAccount("alice", "standard", 1000);
    const b = fundedAccount("bob", "standard", 0);
    expect(transfer(a.id, b.id, 100, "rent")).toBeDefined();
  });
  it("runs with a missing account", () => {
    expect(transfer("nope", "nada", 10, "x")).toBeDefined();
  });
  it("runs with a frozen account", () => {
    const a = fundedAccount("alice", "standard", 1000);
    const b = fundedAccount("bob", "standard", 0);
    setFrozen(a.id, true);
    expect(transfer(a.id, b.id, 10, "x")).toBeDefined();
  });
  it("runs with a non-positive amount", () => {
    const a = fundedAccount("alice", "standard", 1000);
    const b = fundedAccount("bob", "standard", 0);
    expect(transfer(a.id, b.id, 0, "x")).toBeDefined();
  });
  it("runs the cross-owner limit branch", () => {
    const a = fundedAccount("alice", "standard", 10000);
    const b = fundedAccount("bob", "standard", 0);
    expect(transfer(a.id, b.id, 4600, "x")).toBeDefined();
  });
  it("runs the same-owner branch", () => {
    const a = fundedAccount("alice", "standard", 10000);
    const b = fundedAccount("alice", "savings", 0);
    expect(transfer(a.id, b.id, 4900, "x")).toBeDefined();
  });
  it("runs the insufficient funds branch", () => {
    const a = fundedAccount("alice", "standard", 5);
    const b = fundedAccount("alice", "savings", 0);
    expect(transfer(a.id, b.id, 50, "x")).toBeDefined();
  });
  it("runs categorisation", () => {
    const a = fundedAccount("alice", "standard", 1000);
    const b = fundedAccount("alice", "savings", 0);
    transfer(a.id, b.id, 10, "UBER trip");
    expect(true).toBe(true);
  });
});
