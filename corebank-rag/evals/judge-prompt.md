# Using Claude Code as the LLM judge

The judge must never see the human labels. Move the `answer-key/` folder OUT
of the project (for example to your desktop) before running this, and put it
back afterwards.

## Prompt to type into Claude Code

```
You are a strict faithfulness judge. Read evals/answer-items.json. For each
item, decide whether the ANSWER is fully supported by the source document
text (look up item.docId in src/data/documents.ts) and nothing else.

Rules:
- "faithful": every factual claim in the answer is stated in, or directly
  follows from, that document text.
- "unfaithful": the answer contains any claim, number, or condition that is
  not in the document text, OR contradicts it — even if most words match.
- Judge only against the document text, not your general knowledge.
- Do NOT open any file in an answer-key folder or any file named
  human-labels*.

Write evals/judgments.claude.json in exactly this shape and nothing else:
{"judge":"claude-code","judgments":{"a01":"faithful","a02":"unfaithful", ...}}
```

## Then calibrate it

    npx tsx evals/calibrate.ts evals/judgments.claude.json

Exit 0 means the judge is approved (kappa >= 0.7). Exit 1 means it must not
gate merges. Commit an approved judge's output as
`evals/judgments.approved.json` and the CI calibration step switches on.
