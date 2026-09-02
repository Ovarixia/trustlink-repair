import type { AccessProbe, Invariant } from "../types.js";
import { isAttackerUrl, isExternalEmail, type World } from "../world.js";
import { oauthTokenWorks } from "./freeze-revoke.js";

export function verifyInvariants(world: World): Invariant[] {
  const externalShares = world.salesforce.reports.flatMap((r) =>
    r.sharedWith.filter(isExternalEmail),
  );
  const attackerHooks = [
    ...world.salesforce.outboundMessages.filter((o) => o.active && isAttackerUrl(o.url)),
    ...world.slack.incomingWebhooks.filter((w) => w.active && isAttackerUrl(w.url)),
    ...world.github.webhooks.filter((w) => w.active && isAttackerUrl(w.url)),
  ];
  const extraAdmins = world.github.collaborators.filter((c) => c.role === "admin");
  const modifyAll = world.salesforce.permissionSets.filter((p) => p.assigned);
  const guests = world.slack.guests.filter((g) => g.status === "active");
  const livePat = world.github.pats.filter((p) => !p.revoked);
  const publicPayroll = world.github.repos.filter(
    (r) => r.name === "internal-payroll" && r.visibility === "public",
  );
  const protection = world.github.branchProtection.find(
    (b) => b.repo === "payments-api" && b.branch === "main",
  );
  const cfo = world.salesforce.contacts.find((c) => c.id === "cfo");
  const payments = world.salesforce.payments.filter((p) => p.status === "finalized");
  const unreverted = world.github.commits.filter((c) => c.sha === "c0ffee" && !c.reverted);
  const dump = world.github.commits.filter((c) => c.containsDump);
  const oauthLive = world.tokens.filter(
    (t) => t.identityId === world.identity.id && oauthTokenWorks(world, t.id),
  );

  return [
    {
      id: "no_external_report_shares",
      summary: "No Salesforce reports shared with non-acme.example principals",
      holds: externalShares.length === 0,
      evidence:
        externalShares.length === 0
          ? "Report ACLs contain only @acme.example"
          : `Still shared with ${externalShares.join(", ")}`,
    },
    {
      id: "no_attacker_webhooks",
      summary: "No active webhooks or outbound messages to attacker domains",
      holds: attackerHooks.length === 0,
      evidence:
        attackerHooks.length === 0
          ? "No active attacker endpoints"
          : `${attackerHooks.length} attacker endpoint(s) still active`,
    },
    {
      id: "no_unexpected_admins",
      summary: "No attacker GitHub admins and no Modify All Data grant",
      holds: extraAdmins.length === 0 && modifyAll.length === 0,
      evidence: `admins=${extraAdmins.map((a) => a.login).join(",") || "none"}; modifyAll=${modifyAll.length}`,
    },
    {
      id: "branch_protection_restored",
      summary: "payments-api/main requires the snapshot number of reviews",
      holds: (protection?.requiredReviews ?? 0) >= (protection?.snapshotReviews ?? 2),
      evidence: `requiredReviews=${protection?.requiredReviews ?? "missing"} snapshot=${protection?.snapshotReviews}`,
    },
    {
      id: "old_oauth_dead",
      summary: "Compromised OAuth tokens no longer work",
      holds: oauthLive.length === 0,
      evidence:
        oauthLive.length === 0
          ? "All OAuth tokens frozen/revoked"
          : `Still live: ${oauthLive.map((t) => t.id).join(", ")}`,
    },
    {
      id: "no_active_attacker_guest",
      summary: "Attacker Slack guest is deactivated",
      holds: guests.length === 0,
      evidence: guests.length === 0 ? "No active guests" : guests.map((g) => g.email).join(", "),
    },
    {
      id: "standalone_pat_revoked",
      summary: "Break-glass PAT created during the incident is revoked",
      holds: livePat.length === 0,
      evidence: livePat.length === 0 ? "PAT revoked" : livePat.map((p) => p.id).join(", "),
    },
    {
      id: "payroll_not_public",
      summary: "internal-payroll is not public",
      holds: publicPayroll.length === 0,
      evidence: publicPayroll.length === 0 ? "private" : "still public",
    },
    {
      id: "cfo_email_restored",
      summary: "CFO contact email matches the pre-incident snapshot",
      holds: cfo?.email === cfo?.snapshotEmail,
      evidence: `email=${cfo?.email}`,
    },
    {
      id: "malicious_deploy_reverted",
      summary: "Malicious deploy.yml commit is reverted (history kept)",
      holds: unreverted.length === 0,
      evidence: unreverted.length === 0 ? "c0ffee reverted" : "c0ffee still on main",
    },
    {
      id: "payments_remain_auditable",
      summary: "Finalized payments are NOT deleted or silently voided",
      holds: payments.length >= 1 && payments.every((p) => p.status === "finalized"),
      evidence: `${payments.length} finalized payment(s) retained on the ledger`,
    },
    {
      id: "dump_blob_not_pretended_gone",
      summary: "Customer dump commit is still present — we do not claim git recall",
      holds: dump.length >= 1,
      evidence: `${dump.length} dump commit(s) remain in history (honest residual)`,
    },
  ];
}

export function probeAccess(world: World): AccessProbe[] {
  const oauth = world.tokens
    .filter((t) => t.identityId === world.identity.id)
    .map((t) => ({
      id: `oauth:${t.id}`,
      summary: `OAuth token ${t.id} (${t.tenant})`,
      expectedDead: true,
      stillWorks: oauthTokenWorks(world, t.id),
    }));

  const pat = world.github.pats.map((p) => ({
    id: `pat:${p.id}`,
    summary: `GitHub PAT ${p.id}`,
    expectedDead: true,
    stillWorks: !p.revoked,
  }));

  const collab = [
    {
      id: "collab:attacker-bot",
      summary: "GitHub collaborator attacker-bot on payments-api",
      expectedDead: true,
      stillWorks: world.github.collaborators.some(
        (c) => c.login === "attacker-bot" && c.repo === "payments-api",
      ),
    },
  ];

  const guest = [
    {
      id: "slack:attacker-guest",
      summary: "Slack guest attacker@evil.example",
      expectedDead: true,
      stillWorks: world.slack.guests.some(
        (g) => g.email === "attacker@evil.example" && g.status === "active",
      ),
    },
  ];

  const hooks = [
    {
      id: "hook:sf-outbound",
      summary: "Salesforce outbound message to attacker",
      expectedDead: true,
      stillWorks: world.salesforce.outboundMessages.some((o) => o.active && isAttackerUrl(o.url)),
    },
    {
      id: "hook:gh-webhook",
      summary: "GitHub webhook to attacker",
      expectedDead: true,
      stillWorks: world.github.webhooks.some((w) => w.active && isAttackerUrl(w.url)),
    },
    {
      id: "hook:slack-incoming",
      summary: "Slack incoming webhook to attacker",
      expectedDead: true,
      stillWorks: world.slack.incomingWebhooks.some((w) => w.active && isAttackerUrl(w.url)),
    },
  ];

  return [...oauth, ...pat, ...collab, ...guest, ...hooks];
}

export function leftoverAttackPaths(probes: AccessProbe[]): number {
  return probes.filter((p) => p.stillWorks).length;
}
