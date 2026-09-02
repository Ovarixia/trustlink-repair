export { runComparison, WHAT_WE_DO_NOT_UNDO } from "./demo.js";
export { seedMutations, seedWorld } from "./fixtures.js";
export { buildCausalGraph, mermaidGraph, reverseCausalOrder } from "./engine/graph.js";
export { proposePlan } from "./engine/plan.js";
export { runRevokeOnly, runTrustLink } from "./engine/runbooks.js";
export { verifyInvariants, probeAccess } from "./engine/verify.js";
export { renderHtml, renderMarkdown, renderTerminal, toJson } from "./report.js";
export type {
  Classification,
  ComparisonReport,
  Mutation,
  RunResult,
} from "./types.js";
