import { store } from "../src/store.js";
import { createAccount } from "../src/services/accountService.js";
import type { AccountType } from "../src/models/Account.js";

export function resetStore() {
  store.accounts.clear();
  store.transactions.length = 0;
  store.dailyTransferTotals.clear();
}
export function fundedAccount(owner: string, type: AccountType, balance: number) {
  const a = createAccount(owner, type);
  a.balance = balance;
  store.saveAccount(a);
  return a;
}
