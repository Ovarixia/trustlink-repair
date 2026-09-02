import type { Classification, Compensation, Effect, Mutation, PlanStep } from "../types.js";
import { reverseCausalOrder } from "./graph.js";

export const CLASSIFICATIONS: Classification[] = [
  "reversible",
  "compensable",
  "irreversible",
  "UNKNOWN",
];

export function classifyEffects(mutations: Mutation[]): Effect[] {
  const effects = mutations.flatMap((m) => m.effects);
  for (const e of effects) {
    if (!CLASSIFICATIONS.includes(e.classification)) {
      throw new Error(`Effect ${e.id} has invalid classification`);
    }
  }
  return effects;
}

export function isRepairable(e: Effect): boolean {
  return e.classification === "reversible" || e.classification === "compensable";
}

export function compensationFor(effect: Effect): Compensation | undefined {
  if (!isRepairable(effect)) return undefined;
  const mode = effect.classification === "reversible" ? "inverse" : "compensate";
  return {
    id: `cmp-${effect.id}`,
    effectId: effect.id,
    mutationId: effect.mutationId,
    tenant: effect.tenant,
    kind: kindFor(effect),
    summary: summaryFor(effect),
    mode,
  };
}

function kindFor(effect: Effect): string {
  const table: Record<string, string> = {
    "eff-m01-sf-permset-grant": "unassign_permission_set",
    "eff-m02-sf-share-report-acl": "unshare_report",
    "eff-m03-sf-sharing-rule-owd": "restore_sharing_rule",
    "eff-m04-sf-outbound-hook": "delete_outbound_message",
    "eff-m07-sf-contact-email-email": "restore_contact_email",
    "eff-m08-slack-guest-guest": "deactivate_guest",
    "eff-m09-slack-file-link-link": "revoke_public_file_link",
    "eff-m10-slack-webhook-hook": "disable_incoming_webhook",
    "eff-m11-slack-secret-post-msg": "delete_message",
    "eff-m12-slack-bot-app": "uninstall_bot",
    "eff-m13-gh-collab-acl": "remove_collaborator",
    "eff-m14-gh-protection-rules": "restore_branch_protection",
    "eff-m15-gh-push-code": "revert_commit",
    "eff-m16-gh-webhook-hook": "delete_repo_webhook",
    "eff-m17-gh-pat-pat": "revoke_pat",
    "eff-m18-gh-public-vis": "make_repo_private",
    "eff-m19-gh-secret-secret": "rotate_actions_secret",
  };
  return table[effect.id] ?? `repair_${effect.id}`;
}

function summaryFor(effect: Effect): string {
  const table: Record<string, string> = {
    "eff-m01-sf-permset-grant": "Unassign Modify All Data from the compromised identity",
    "eff-m02-sf-share-report-acl": "Remove vendor@evil.example from Q4 Pipeline",
    "eff-m03-sf-sharing-rule-owd": "Restore Account OWD to Private",
    "eff-m04-sf-outbound-hook": "Delete outbound message om-sf-exfil",
    "eff-m07-sf-contact-email-email": "Restore CFO contact email from snapshot",
    "eff-m08-slack-guest-guest": "Deactivate attacker@evil.example guest",
    "eff-m09-slack-file-link-link": "Revoke public link for board-minutes.pdf",
    "eff-m10-slack-webhook-hook": "Disable attacker incoming webhook",
    "eff-m11-slack-secret-post-msg": "Delete the #general secret-bearing message",
    "eff-m12-slack-bot-app": "Uninstall Helpful Sync bot",
    "eff-m13-gh-collab-acl": "Remove attacker-bot from payments-api",
    "eff-m14-gh-protection-rules": "Restore 2 required reviews on main",
    "eff-m15-gh-push-code": "Revert commit c0ffee (no force-push)",
    "eff-m16-gh-webhook-hook": "Delete attacker GitHub webhook",
    "eff-m17-gh-pat-pat": "Revoke PAT pat-alex-breakglass",
    "eff-m18-gh-public-vis": "Set internal-payroll back to private",
    "eff-m19-gh-secret-secret": "Rotate PRODUCTION_DEPLOY_KEY to a new fingerprint",
  };
  return table[effect.id] ?? `Compensate ${effect.summary}`;
}

export function proposePlan(mutations: Mutation[]): PlanStep[] {
  const order = reverseCausalOrder(mutations);
  const steps: PlanStep[] = [];
  let n = 1;
  for (const mutation of order) {
    for (const effect of mutation.effects) {
      const compensation = compensationFor(effect);
      if (!compensation) continue;
      steps.push({
        order: n++,
        compensation,
        dependsOnCleared: mutation.causedBy,
      });
    }
  }
  return steps;
}
