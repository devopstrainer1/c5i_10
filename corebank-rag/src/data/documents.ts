export interface Document {
  id: string;
  title: string;
  text: string;
  tier: "public" | "internal" | "compliance";
}

// Deliberately small and heterogeneous — some documents overlap in
// vocabulary (limit, overdraft, transfer) on purpose, so retrieval
// quality is actually visible: a bad retriever confuses "daily
// transfer limit" with "overdraft limit," a good one doesn't.
export const documents: Document[] = [
  {
    id: "doc-1",
    title: "Account Types Overview",
    text: "CoreBank offers three account types: standard, premium, and savings. Standard accounts have a zero minimum balance and no overdraft. Premium accounts carry a built-in overdraft allowance of $5,000, intended for customers with an established relationship. Savings accounts earn interest but do not support overdraft.",
    tier: "public",
  },
  {
    id: "doc-2",
    title: "Daily Transfer Limits",
    text: "To limit fraud exposure, outbound transfers between accounts under different owners are capped per calendar day. This limit does not apply to transfers between two accounts owned by the same customer, since those movements stay within the customer's own portfolio rather than reaching a third party.",
    tier: "public",
  },
  {
    id: "doc-3",
    title: "Overdraft Policy for Premium Accounts",
    text: "Premium account holders may carry a negative balance up to the account's configured overdraft limit without triggering a decline. Overdraft usage is reviewed quarterly; accounts that remain in overdraft for more than 60 consecutive days are flagged for a relationship manager review.",
    tier: "internal",
  },
  {
    id: "doc-4",
    title: "Dispute Resolution Procedure",
    text: "A customer disputing a transaction must file within 60 days of the posting date. Disputes involving transfers between accounts under the same owner are resolved administratively, without escalation, since no third party is involved. Disputes involving a third-party transfer are escalated to the fraud review team.",
    tier: "internal",
  },
  {
    id: "doc-5",
    title: "Know Your Customer (KYC) Requirements",
    text: "All new accounts require identity verification before the first transaction is permitted. Premium account applications require an additional income verification step, given the overdraft exposure the bank is extending. Savings accounts follow standard KYC only.",
    tier: "compliance",
  },
  {
    id: "doc-6",
    title: "Fraud Monitoring and Account Freezes",
    text: "Accounts showing unusual transfer patterns — rapid transfers just under the daily limit, or a burst of transfers to newly-added recipients — are automatically flagged for review. A flagged account may be frozen pending manual review, which blocks all outbound transfers until the freeze is lifted by an authorized reviewer.",
    tier: "compliance",
  },
  {
    id: "doc-7",
    title: "Savings Account Interest Policy",
    text: "Savings accounts accrue simple interest at an annual rate, calculated and posted once per statement period. Interest is not compounded intra-period. The posted amount depends on the account's balance at the start of the period and the exact number of days in that period.",
    tier: "public",
  },
  {
    id: "doc-8",
    title: "Fee Schedule",
    text: "Standard accounts carry no monthly fee. Premium accounts carry a $15 monthly fee, waived if the average daily balance exceeds $10,000. Savings accounts carry no fee but are limited to six withdrawals per statement period under federal guidance.",
    tier: "public",
  },
];
