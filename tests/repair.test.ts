import { describe, expect, it } from "vitest";
import { runComparison } from "../src/demo.js";
import { seedWorld } from "../src/fixtures.js";
import { runRevokeOnly, runTrustLink } from "../src/engine/runbooks.js";
import { cloneWorld } from "../src/world.js";
import { recoveredTokenWorks } from "../src/engine/reonboard.js";
import { oauthTokenWorks } from "../src/engine/freeze-revoke.js";
import { computeMetrics } from "../src/engine/metrics.js";

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

  it("repairs exact targets while preserving adversarial decoys", () => {
    const world = seedWorld();
    world.salesforce.reports[0]!.sharedWith.push("unrelated@external.example");
    world.slack.messages.unshift({
      channel: "#general",
      ts: "1756741919.000001",
      text: "legitimate message",
      deleted: false,
      mayHaveBeenCopied: false,
    });
    world.github.webhooks.unshift({
      repo: "unrelated-repo",
      url: "https://exfil.attacker.example/gh",
      active: true,
    });
    world.github.secrets.unshift({
      repo: "unrelated-repo",
      name: "PRODUCTION_DEPLOY_KEY",
      fingerprint: "preserve-me",
      rotated: false,
      snapshotFingerprint: "preserve-me",
    });

    const result = runTrustLink(world);
    expect(world.salesforce.reports[0]!.sharedWith).toContain("unrelated@external.example");
    expect(world.slack.messages[0]!.deleted).toBe(false);
    expect(world.github.webhooks[0]!.active).toBe(true);
    expect(world.github.secrets[0]!.fingerprint).toBe("preserve-me");
    expect(world.github.webhooks.find((item) => item.repo === "payments-api")?.active).toBe(false);
    expect(world.github.secrets.find((item) => item.repo === "payments-api")?.rotated).toBe(true);
    expect(result.metrics.coverage).toBe(1);
    expect(result.steps.filter((step) => step.outcome === "executed").every((step) => step.postcondition?.holds)).toBe(true);
  });

  it("counts a structured false-undo claim when its postcondition is false", () => {
    const result = runTrustLink(cloneWorld(seedWorld()));
    const { metrics: _metrics, ...run } = result;
    const claimed = run.steps.find((step) => step.claimedFullyUndone);
    expect(claimed).toBeDefined();
    claimed!.postcondition = { holds: false, evidence: "adversarial readback" };
    expect(computeMetrics(run, 0).falseUndoPositives).toBe(1);
  });

  it("abstains when canonical identifiers resolve to more than one resource", () => {
    const world = seedWorld();
    world.github.webhooks.push({
      repo: "payments-api",
      url: "https://exfil.attacker.example/gh",
      active: true,
    });
    const result = runTrustLink(world);
    const step = result.steps.find((item) => item.effectId === "eff-m16-gh-webhook-hook");
    expect(step?.outcome).toBe("blocked_by_simulation");
    expect(world.github.webhooks.filter((item) => item.repo === "payments-api").every((item) => item.active)).toBe(true);
    expect(result.metrics.coverage).toBeLessThan(1);
  });

  it("does not treat one satisfied duplicate as an idempotent repair", () => {
    const world = seedWorld();
    world.github.webhooks.push({
      repo: "payments-api",
      url: "https://exfil.attacker.example/gh",
      active: false,
    });
    const result = runTrustLink(world);
    const step = result.steps.find((item) => item.effectId === "eff-m16-gh-webhook-hook");
    expect(step?.outcome).toBe("blocked_by_simulation");
    expect(world.github.webhooks.some((item) => item.repo === "payments-api" && item.active)).toBe(true);
    expect(result.metrics.coverage).toBeLessThan(1);
  });

  it("uses immutable recovery targets instead of mutable colocated snapshots", () => {
    const world = seedWorld();
    world.salesforce.sharing[0]!.previousLevel = "PublicReadWrite";
    world.salesforce.contacts[0]!.snapshotEmail = "cfo@evil.example";
    world.github.branchProtection[0]!.snapshotReviews = 0;
    const result = runTrustLink(world);
    expect(world.salesforce.sharing[0]!.level).toBe("Private");
    expect(world.salesforce.contacts[0]!.email).toBe("cfo@acme.example");
    expect(world.github.branchProtection[0]!.requiredReviews).toBe(2);
    expect(result.metrics.falseUndoPositives).toBe(0);
    expect(result.invariants.find((item) => item.id === "branch_protection_restored")?.holds).toBe(true);
    expect(result.invariants.find((item) => item.id === "cfo_email_restored")?.holds).toBe(true);
  });

  it("is idempotent when exact repair postconditions already hold", () => {
    const world = seedWorld();
    runTrustLink(world);
    const second = runTrustLink(world);
    expect(second.metrics.coverage).toBe(1);
    expect(second.steps.filter((step) => step.outcome === "already_satisfied").length).toBeGreaterThan(0);
    expect(second.metrics.falseUndoPositives).toBe(0);
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
