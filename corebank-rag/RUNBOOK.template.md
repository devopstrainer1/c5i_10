# Operating runbook — <<SERVICE NAME>>

> Fill in every <<...>>. A runbook is finished when someone who has never seen
> this service could follow it at 3am. Leave nothing as "ask Priya".

## 1. What this service does, and who owns it
- Purpose (one sentence): <<...>>
- Owner / on-call rota: <<...>>
- Escalation contact if the owner does not answer in 15 minutes: <<...>>

## 2. Signals — what "healthy" means
| Signal | Where to see it | Healthy | Alert when |
|---|---|---|---|
| 5xx error rate | <<...>> | <<...>> | <<threshold and duration>> |
| Latency (p95) | <<...>> | <<...>> | <<...>> |
| Estimated cost per 1,000 requests | <<...>> | <<baseline>> | <<multiple of baseline>> |
| Retrieval eval gate on main | CI | green | red |
| Permission leaks | <<...>> | 0 | any |

## 3. How a release goes out
- Canary steps and how long at each: <<...>>
- What the router judges, and the rollback threshold: <<...>>

## 4. Rolling back
- Automatic: <<what triggers it>>
- Manual command: <<exact command>>
- How to confirm it worked: <<exact command and expected output>>

## 5. First five minutes of any incident
1. <<...>>
2. <<...>>
3. <<...>>

## 6. Playbooks
### 5xx spike after a release
<<symptoms · likely cause · what to do · how to verify>>
### Answer or retrieval quality dropped
<<...>>
### Cost per request jumped
<<...>>
### A user saw data they should not (SEVERITY 1)
<<...>>

## 7. After the incident
- Postmortem due within: <<...>>
- Required sections: <<timeline · impact · root cause · what detected it · what would have detected it sooner · actions with owners>>
