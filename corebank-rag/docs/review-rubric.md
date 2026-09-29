# Review rubric for agent-written changes

A reviewer signs off on EVIDENCE, not on the agent's summary. For each line,
"yes" means you saw the proof yourself.

| # | Question | Evidence to look for |
|---|---|---|
| 1 | Does every stated requirement map to a test that would FAIL if it broke? | Name the test. Break the line by hand (or run mutation testing) and watch it fail. |
| 2 | Are assertions about behaviour — not just "it returned something"? | Look for `toBeDefined()`, `toBeTruthy()`, `expect(true)`. |
| 3 | Was every third-party API call checked against CURRENT documentation? | Context7 lookup or a real run against the installed version. Compiling is not proof. |
| 4 | Is the diff limited to what was asked? | Files touched vs. the stated blast radius. |
| 5 | Any new dependency, secret, or permission? | Read the lockfile diff. Scan output is clean. |
| 6 | If an AI feature changed: did the eval set change with it, and is the gate green? | `evals/gate.ts` output, plus new eval cases for the new behaviour. |
| 7 | Can we operate it? | Structured logs, a trace id, a health check, and a rollback path exist for this change. |
