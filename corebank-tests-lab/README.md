# Coverage vs. mutation lab (CoreBank transferService)

    npm install
    TEST_SUITE=theatre npx vitest run --coverage     # 100% coverage
    TEST_SUITE=real    npx vitest run --coverage     # also 100% coverage
    TEST_SUITE=theatre npx stryker run               # mutation score ~4.8%
    TEST_SUITE=real    npx stryker run               # mutation score ~84%, 10 survivors to triage

Expected: identical coverage, wildly different mutation scores.

`answer-key/` holds the tests that kill 8 of the 10 survivors (the other 2 are
equivalent mutants). Do not hand it out until learners have triaged the
survivors themselves. `TEST_SUITE=answer npx stryker run` -> ~96.8%.
