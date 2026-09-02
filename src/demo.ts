import { seedWorld } from "./fixtures.js";
import type { ComparisonReport } from "./types.js";
import { cloneWorld } from "./world.js";
import { runRevokeOnly, runTrustLink } from "./engine/runbooks.js";

export const WHAT_WE_DO_NOT_UNDO = [
  "Exfiltrated Salesforce lead CSV (12,400 rows) — the file already left the tenant.",
  "Finalized $18,400 vendor payment — ledger stays auditable; treasury recall is out of band.",
  "Git blob of customers.dump — rewriting shared history is unsafe and does not recall clones.",
  "Unknown Slack file downloads, screenshots of the posted AWS key, and unknown clones of the briefly public repo.",
];

export function runComparison(): ComparisonReport {
  const seeded = seedWorld();
  const trustlink = runTrustLink(cloneWorld(seeded));
  const revokeOnly = runRevokeOnly(cloneWorld(seeded));

  return {
    generatedAt: new Date().toISOString(),
    incident:
      "Compromised OAuth identity alex.chen@acme.example across synthetic Salesforce, Slack, and GitHub",
    trustlink,
    revokeOnly,
    winner: {
      coverage:
        trustlink.metrics.coverage >= revokeOnly.metrics.coverage ? "trustlink" : "revoke-only",
      leftoverAttackPaths:
        trustlink.metrics.leftoverAttackPaths <= revokeOnly.metrics.leftoverAttackPaths
          ? "trustlink"
          : "revoke-only",
      falseUndoPositives:
        trustlink.metrics.falseUndoPositives === revokeOnly.metrics.falseUndoPositives
          ? "tie"
          : trustlink.metrics.falseUndoPositives < revokeOnly.metrics.falseUndoPositives
            ? "trustlink"
            : "revoke-only",
    },
    whatWeDoNotUndo: WHAT_WE_DO_NOT_UNDO,
  };
}
