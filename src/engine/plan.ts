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

export function compensationFor(effect: Effect, mutation: Mutation): Compensation | undefined {
  if (!isRepairable(effect)) return undefined;
  const spec = COMPENSATION_SPECS[effect.id];
  if (!spec || spec.mutationId !== effect.mutationId || spec.tenant !== effect.tenant ||
      mutation.id !== effect.mutationId || mutation.tenant !== effect.tenant ||
      mutation.target !== spec.mutationTarget ||
      !mutation.effects.some((candidate) => candidate.id === effect.id)) {
    throw new Error(`No target-bound compensation spec for ${effect.id}`);
  }
  const mode = effect.classification === "reversible" ? "inverse" : "compensate";
  return {
    id: `cmp-${effect.id}`,
    effectId: effect.id,
    mutationId: effect.mutationId,
    tenant: effect.tenant,
    kind: spec.kind,
    summary: summaryFor(effect),
    mode,
    target: structuredClone(spec.target),
  };
}

interface CompensationSpec {
  kind: string;
  mutationId: string;
  mutationTarget: string;
  tenant: Compensation["tenant"];
  target: Compensation["target"];
}

const target = (
  resource: string,
  identifiers: Record<string, string>,
  expected: Record<string, string | number | boolean> = {},
): Compensation["target"] => ({ resource, identifiers, expected });

const COMPENSATION_SPECS: Record<string, CompensationSpec> = {
  "eff-m01-sf-permset-grant": { kind: "unassign_permission_set", mutationId: "m01-sf-permset", mutationTarget: "PermissionSet:ModifyAllData", tenant: "salesforce", target: target("salesforce.permission-set", { userId: "id-alex-chen", name: "Modify All Data" }) },
  "eff-m02-sf-share-report-acl": { kind: "unshare_report", mutationId: "m02-sf-share-report", mutationTarget: "Report:q4-pipeline", tenant: "salesforce", target: target("salesforce.report-share", { reportId: "q4-pipeline", principal: "vendor@evil.example" }) },
  "eff-m03-sf-sharing-rule-owd": { kind: "restore_sharing_rule", mutationId: "m03-sf-sharing-rule", mutationTarget: "Sharing:Account", tenant: "salesforce", target: target("salesforce.sharing-rule", { object: "Account" }, { level: "Private" }) },
  "eff-m04-sf-outbound-hook": { kind: "delete_outbound_message", mutationId: "m04-sf-outbound", mutationTarget: "OutboundMessage:om-sf-exfil", tenant: "salesforce", target: target("salesforce.outbound-message", { id: "om-sf-exfil" }) },
  "eff-m07-sf-contact-email-email": { kind: "restore_contact_email", mutationId: "m07-sf-contact-email", mutationTarget: "Contact:cfo", tenant: "salesforce", target: target("salesforce.contact", { id: "cfo" }, { email: "cfo@acme.example" }) },
  "eff-m08-slack-guest-guest": { kind: "deactivate_guest", mutationId: "m08-slack-guest", mutationTarget: "SlackUser:attacker@evil.example", tenant: "slack", target: target("slack.guest", { email: "attacker@evil.example" }) },
  "eff-m09-slack-file-link-link": { kind: "revoke_public_file_link", mutationId: "m09-slack-file-link", mutationTarget: "File:board-minutes.pdf", tenant: "slack", target: target("slack.public-file-link", { file: "board-minutes.pdf" }) },
  "eff-m10-slack-webhook-hook": { kind: "disable_incoming_webhook", mutationId: "m10-slack-webhook", mutationTarget: "IncomingWebhook:wh-alerts", tenant: "slack", target: target("slack.incoming-webhook", { id: "wh-alerts" }) },
  "eff-m11-slack-secret-post-msg": { kind: "delete_message", mutationId: "m11-slack-secret-post", mutationTarget: "Message:general-secret", tenant: "slack", target: target("slack.message", { channel: "#general", ts: "1756741920.000100" }) },
  "eff-m12-slack-bot-app": { kind: "uninstall_bot", mutationId: "m12-slack-bot", mutationTarget: "Bot:helpful-sync", tenant: "slack", target: target("slack.bot", { name: "Helpful Sync" }) },
  "eff-m13-gh-collab-acl": { kind: "remove_collaborator", mutationId: "m13-gh-collab", mutationTarget: "Repo:payments-api/collaborator:attacker-bot", tenant: "github", target: target("github.collaborator", { repo: "payments-api", login: "attacker-bot" }) },
  "eff-m14-gh-protection-rules": { kind: "restore_branch_protection", mutationId: "m14-gh-protection", mutationTarget: "BranchProtection:payments-api/main", tenant: "github", target: target("github.branch-protection", { repo: "payments-api", branch: "main" }, { requiredReviews: 2 }) },
  "eff-m15-gh-push-code": { kind: "revert_commit", mutationId: "m15-gh-push", mutationTarget: "Commit:payments-api:c0ffee", tenant: "github", target: target("github.commit", { repo: "payments-api", sha: "c0ffee" }) },
  "eff-m16-gh-webhook-hook": { kind: "delete_repo_webhook", mutationId: "m16-gh-webhook", mutationTarget: "Webhook:payments-api:attacker", tenant: "github", target: target("github.webhook", { repo: "payments-api", url: "https://exfil.attacker.example/gh" }) },
  "eff-m17-gh-pat-pat": { kind: "revoke_pat", mutationId: "m17-gh-pat", mutationTarget: "PAT:pat-alex-breakglass", tenant: "github", target: target("github.pat", { id: "pat-alex-breakglass" }) },
  "eff-m18-gh-public-vis": { kind: "make_repo_private", mutationId: "m18-gh-public", mutationTarget: "Repo:internal-payroll", tenant: "github", target: target("github.repo", { name: "internal-payroll" }) },
  "eff-m19-gh-secret-secret": { kind: "rotate_actions_secret", mutationId: "m19-gh-secret", mutationTarget: "ActionsSecret:payments-api:PRODUCTION_DEPLOY_KEY", tenant: "github", target: target("github.actions-secret", { repo: "payments-api", name: "PRODUCTION_DEPLOY_KEY" }) },
};

function sameTarget(left: Compensation["target"] | undefined, right: Compensation["target"]): boolean {
  if (!left || typeof left.resource !== "string" || !left.identifiers || !left.expected) return false;
  const leftEntries = Object.entries(left.identifiers).sort();
  const rightEntries = Object.entries(right.identifiers).sort();
  const leftExpected = Object.entries(left.expected).sort();
  const rightExpected = Object.entries(right.expected).sort();
  return left.resource === right.resource && JSON.stringify(leftEntries) === JSON.stringify(rightEntries) &&
    JSON.stringify(leftExpected) === JSON.stringify(rightExpected);
}

export function compensationSpecFor(compensation: Compensation): CompensationSpec | undefined {
  const spec = COMPENSATION_SPECS[compensation.effectId];
  if (!spec || compensation.id !== `cmp-${compensation.effectId}` ||
      compensation.kind !== spec.kind || compensation.mutationId !== spec.mutationId ||
      compensation.tenant !== spec.tenant || !sameTarget(compensation.target, spec.target)) {
    return undefined;
  }
  return spec;
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
      const compensation = compensationFor(effect, mutation);
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
