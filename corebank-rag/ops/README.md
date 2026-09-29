# Operating the canary harness

Run three processes (three terminals), then send traffic:

    PORT=4001 VERSION=v1 npx tsx src/http-server.ts                    # stable
    PORT=4002 VERSION=v2 FAULT_RATE=0.4 npx tsx src/http-server.ts     # canary (set FAULT_RATE=0 for a healthy one)
    node ops/router.mjs                                                # router on :8080
    node ops/load.mjs 300                                              # traffic

Router settings (environment): CANARY_STEPS (default 20,50,100), MIN_SAMPLES (20), ERROR_THRESHOLD (0.2), ROUTER_PORT (8080).
Endpoints: GET /__deploy (status)   POST /__rollback (manual kill switch)

## Mapping this harness to a real platform
| This harness | Kubernetes | AWS | Any platform |
|---|---|---|---|
| router.mjs traffic split | Argo Rollouts / Flagger / service mesh | CodeDeploy canary or weighted target groups | load balancer weights |
| error-rate check | analysis template on metrics | CloudWatch alarm | your metrics system |
| automatic rollback | rollout abort | alarm-triggered rollback | pipeline job |
| POST /__rollback | `kubectl argo rollouts abort` | stop deployment | the same command in your runbook |

The pre-provisioned target for the course decides which column you use. The
logic — split, judge, roll back without waiting for a human — is identical.
