import { describe, expect, it } from "vitest";
import { runComparison } from "../src/demo.js";
import { seedWorld } from "../src/fixtures.js";
import { runRevokeOnly, runTrustLink } from "../src/engine/runbooks.js";
import { cloneWorld } from "../src/world.js";
import { recoveredTokenWorks } from "../src/engine/reonboard.js";
import { oauthTokenWorks } from "../src/engine/freeze-revoke.js";

describe("TrustLink vs revoke-only", () => {
  const seeded = seedWorld();
  const trustlink = runTrustLink(cloneWorld(seeded));
  const revokeOnly = runRevokeOnly(cloneWorld(seeded));

  it("executes only validated compensations", () => {
    const bad = trustlink.steps.filter(
      (s) => s.outcome === "executed" && (s.classification === "UNKNOWN" || s.classification === "irreversible"),
    );
    expect(bad).toEqual([]);
  });

  it("abstains on every UNKNOWN effect", () => {
    const unknowns = trustlink.effects.filter((e) => e.classification === "UNKNOWN");
    expect(unknowns.length).toBeGreaterThan(0);
    for (const e of unknowns) {
      const step = trustlink.steps.find((s) => s.effectId === e.id);
      expect(step?.outcome).toBe("abstained_unknown");
    }
  });

  it("does not claim exfil or payment undone", () => {
    const forbidden = ["eff-m05-sf-lead-export-exfil", "eff-m06-sf-payment-money"];
    for (const id of forbidden) {
      const step = trustlink.steps.find((s) => s.effectId === id);
      expect(step?.outcome).toBe("skipped_irreversible");
    }
  });

  it("holds repairable business invariants after TrustLink", () => {
    const mustHold = [
      "no_external_report_shares",
      "no_attacker_webhooks",
      "no_unexpected_admins",
      "branch_protection_restored",
      "old_oauth_dead",
      "no_active_attacker_guest",
      "standalone_pat_revoked",
      "payroll_not_public",
      "cfo_email_restored",
      "malicious_deploy_reverted",
      "payments_remain_auditable",
      "dump_blob_not_pretended_gone",
    ];
    for (const id of mustHold) {
      const inv = trustlink.invariants.find((i) => i.id === id);
      expect(inv?.holds, id).toBe(true);
    }
  });

  it("revoke-only leaves attacker paths alive", () => {
    expect(revokeOnly.metrics.leftoverAttackPaths).toBeGreaterThan(
      trustlink.metrics.leftoverAttackPaths,
    );
    expect(revokeOnly.metrics.coverage).toBe(0);
    const oauthDead = revokeOnly.invariants.find((i) => i.id === "old_oauth_dead");
    const pat = revokeOnly.invariants.find((i) => i.id === "standalone_pat_revoked");
    expect(oauthDead?.holds).toBe(true);
    expect(pat?.holds).toBe(false);
  });

  it("beats revoke-only on coverage with zero false undo positives", () => {
    expect(trustlink.metrics.coverage).toBeGreaterThan(revokeOnly.metrics.coverage);
    expect(trustlink.metrics.coverage).toBe(1);
    expect(trustlink.metrics.falseUndoPositives).toBe(0);
    expect(revokeOnly.metrics.falseUndoPositives).toBe(0);
    expect(trustlink.metrics.leftoverAttackPaths).toBe(0);
  });

  it("re-onboards least privilege and proves old OAuth is dead", () => {
    expect(trustlink.reonboard?.leastPrivilege).toBe(true);
    const world = cloneWorld(seeded);
    const after = runTrustLink(world);
    for (const token of world.tokens) {
      if (token.id.startsWith("tok-") && token.id.endsWith("alex-2026")) {
        expect(oauthTokenWorks(world, token.id)).toBe(false);
      }
    }
    for (const id of after.reonboard?.newTokenIds ?? []) {
      expect(recoveredTokenWorks(world, id)).toBe(true);
    }
  });
});

describe("comparison report", () => {
  it("includes both runbooks and the honest residual list", () => {
    const report = runComparison();
    expect(report.trustlink.runbook).toBe("trustlink");
    expect(report.revokeOnly.runbook).toBe("revoke-only");
    expect(report.whatWeDoNotUndo.length).toBeGreaterThanOrEqual(3);
    expect(report.winner.coverage).toBe("trustlink");
  });
});
