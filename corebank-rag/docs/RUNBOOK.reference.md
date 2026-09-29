# Operating runbook — CoreBank retrieval service (reference answer)

## 1. What this service does, and who owns it
- Purpose: answers policy-document search requests (`GET /retrieve`), applying the caller's permission tier.
- Owner / on-call: Platform team, primary on-call rota. Escalation if no answer in 15 min: engineering manager, then security lead for anything in section 6D.

## 2. Signals — what "healthy" means
| Signal | Where to see it | Healthy | Alert when |
|---|---|---|---|
| 5xx error rate | service JSON logs (`status` field) | under 1% | over 5% for 5 minutes |
| Latency (p95) | service JSON logs (`latencyMs`) | within 2x of the last release | over 3x for 10 minutes |
| Estimated cost / 1,000 requests | logs (`estCostUsd`, sum ×1000/n) | baseline (~$3.08 in the demo; placeholder rates) | over 1.5x baseline |
| Cache hit rate | logs (`cached`) | near the level seen at last release | drops by half (cost follows) |
| Eval gate on main | CI | green | red |
| Permission leaks | eval gate `leaks` | 0 | ANY |

## 3. How a release goes out
- Canary 20% → 50% → 100%. Each stage is judged on the next 20 canary requests.
- The router rolls back automatically if the canary error rate exceeds 20% in a stage.
- Note: with only 20 samples the error rate is noisy (a 40%-faulty canary measured 55% in the drill). More samples = fewer false alarms but a slower rollback and more users affected. Tune deliberately.

## 4. Rolling back
- Automatic: canary error rate over threshold → router sets canary weight to 0 and logs a `ROLLBACK` event.
- Manual (the kill switch): `curl -X POST http://<router>:8080/__rollback`
- Confirm: `curl http://<router>:8080/__deploy` → `"status": "ROLLED_BACK"` and `"weight": 0`. Then watch the stable version's error rate return to normal.

## 5. First five minutes of any incident
1. Say out loud in the incident channel that you are the incident lead, and the time.
2. Check the last deploy: `curl http://<router>:8080/__deploy`. If a canary is live and anything looks wrong, roll back FIRST, investigate second.
3. Look at the error rate and latency by version: `jq -r 'select(.path=="/retrieve") | .version + " " + (.status|tostring)' service.log | sort | uniq -c`.
4. Decide severity (see 6D for the one that is always Severity 1) and page accordingly.
5. Write down what you observe and what you change, with timestamps, as you go.

## 6. Playbooks
### A. 5xx spike after a release
Symptoms: error rate alert; the errors are concentrated on one `version`. Cause: the new version. Action: roll back (section 4). Verify: the new version's share of traffic is 0 and the stable version's errors are back to normal. Do not debug on the live canary.

### B. Answer or retrieval quality dropped
Symptoms: user complaints, or the eval gate turns red on main. Cause: a change to indexing, ranking, or chunking — these pass unit tests, which is exactly why the eval gate exists. Action: find the merge that turned it red (`git bisect` against `evals/gate.ts`), revert it, add an eval case that would have caught it if none existed.

### C. Cost per request jumped
Symptoms: estimated cost per 1,000 requests above 1.5x baseline. First check the cache hit rate — a fall in `cached:true` responses is the usual cause. Then check whether answer-generation input grew (more or longer snippets). Remember the number is an estimate; confirm against the provider's billing data before a financial decision.

### D. A user saw data they should not (SEVERITY 1, always)
1. Roll back to the last known-good version immediately.
2. Do NOT delete logs. Preserve them; the trace ids are how you find who saw what.
3. Notify the security lead and the data owner now, not after you understand it.
4. The eval gate has zero tolerance for leaks because of this playbook: find why it did not catch this case and add the case.

### E. A newly disclosed vulnerability in a dependency
Run `npm audit` on the full tree (never `--omit=dev` for triage). Rank by whether it reaches production, patch or upgrade, and ship through the normal pipeline — an emergency is not a reason to skip the gates.

## 7. After the incident
- Postmortem within 3 working days. Sections: timeline · impact · root cause · what detected it · what would have detected it sooner · actions with named owners and dates.
- Blameless: the question is which check was missing, not who merged.
