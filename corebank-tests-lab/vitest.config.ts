import { defineConfig } from "vitest/config";
// TEST_SUITE lets the same project run either suite, so coverage and
// mutation scores can be compared like-for-like.
const suite = process.env.TEST_SUITE ?? "all";
const include =
  suite === "theatre" ? ["tests/transfer.theatre.test.ts"] :
  suite === "real" ? ["tests/transfer.real.test.ts"] :
  suite === "answer" ? ["tests/transfer.real.test.ts", "answer-key/transfer.killers.test.ts"] :
  ["tests/**/*.test.ts"];
export default defineConfig({ test: { include, coverage: { include: ["src/services/transferService.ts"], reporter: ["text"] } } });
