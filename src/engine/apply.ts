import type { Compensation } from "../types.js";
import type { World } from "../world.js";
import { compensationSpecFor } from "./plan.js";

export interface ApplyResult {
  ok: boolean;
  detail: string;
  /** If true, the runner must not record a "fully undone" claim. */
  residualRemains: boolean;
}

export interface PostconditionResult {
  holds: boolean;
  evidence: string;
}

function uniqueTarget<T>(items: readonly T[], predicate: (item: T) => boolean): T | undefined {
  const matches = items.filter(predicate);
  return matches.length === 1 ? matches[0] : undefined;
}

function uniqueTargetSatisfies<T>(
  items: readonly T[],
  predicate: (item: T) => boolean,
  postcondition: (item: T) => boolean,
): boolean {
  const item = uniqueTarget(items, predicate);
  return item !== undefined && postcondition(item);
}

/**
 * Apply a single compensation. Used both for simulation (on a clone)
 * and for real execution. Never "undoes" exfil or finalized payments.
 */
export function applyCompensation(world: World, cmp: Compensation): ApplyResult {
  const spec = compensationSpecFor(cmp);
  if (!spec) {
    return { ok: false, detail: "Compensation descriptor is not bound to its canonical effect target", residualRemains: true };
  }
  const ids = spec.target.identifiers;
  const expected = spec.target.expected;
  switch (cmp.kind) {
    case "unassign_permission_set": {
      const row = uniqueTarget(world.salesforce.permissionSets,
        (p) => p.userId === ids.userId && p.name === ids.name,
      );
      if (!row) return { ok: false, detail: "Permission set row missing", residualRemains: false };
      row.assigned = false;
      return { ok: true, detail: "Unassigned Modify All Data", residualRemains: false };
    }
    case "unshare_report": {
      const report = uniqueTarget(world.salesforce.reports, (r) => r.id === ids.reportId);
      if (!report) return { ok: false, detail: "Report missing", residualRemains: false };
      if (!report.sharedWith.includes(ids.principal!)) return { ok: false, detail: "Exact report share missing", residualRemains: false };
      report.sharedWith = report.sharedWith.filter((email) => email !== ids.principal);
      return { ok: true, detail: `Removed exact report share ${ids.principal}`, residualRemains: false };
    }
    case "restore_sharing_rule": {
      const rule = uniqueTarget(world.salesforce.sharing, (s) => s.object === ids.object);
      if (!rule) return { ok: false, detail: "Sharing rule missing", residualRemains: false };
      rule.level = String(expected.level);
      return { ok: true, detail: `Account OWD restored to ${rule.level}`, residualRemains: false };
    }
    case "delete_outbound_message": {
      const om = uniqueTarget(world.salesforce.outboundMessages, (o) => o.id === ids.id);
      if (!om) return { ok: false, detail: "Outbound message missing", residualRemains: false };
      om.active = false;
      return { ok: true, detail: "Outbound message deactivated", residualRemains: false };
    }
    case "restore_contact_email": {
      const c = uniqueTarget(world.salesforce.contacts, (x) => x.id === ids.id);
      if (!c) return { ok: false, detail: "Contact missing", residualRemains: false };
      c.email = String(expected.email);
      return {
        ok: true,
        detail: `CFO email restored to ${c.email}`,
        residualRemains: true,
      };
    }
    case "deactivate_guest": {
      const g = uniqueTarget(world.slack.guests, (x) => x.email === ids.email);
      if (!g) return { ok: false, detail: "Guest missing", residualRemains: false };
      g.status = "deactivated";
      return { ok: true, detail: "Guest deactivated", residualRemains: false };
    }
    case "revoke_public_file_link": {
      const link = uniqueTarget(world.slack.publicFileLinks, (f) => f.file === ids.file);
      if (!link) return { ok: false, detail: "File link missing", residualRemains: false };
      link.active = false;
      return {
        ok: true,
        detail: "Public file link revoked",
        residualRemains: link.downloadsUnknown,
      };
    }
    case "disable_incoming_webhook": {
      const wh = uniqueTarget(world.slack.incomingWebhooks, (w) => w.id === ids.id);
      if (!wh) return { ok: false, detail: "Webhook missing", residualRemains: false };
      wh.active = false;
      return { ok: true, detail: "Incoming webhook disabled", residualRemains: false };
    }
    case "delete_message": {
      const msg = uniqueTarget(world.slack.messages, (m) => m.channel === ids.channel && m.ts === ids.ts);
      if (!msg) return { ok: false, detail: "Message missing", residualRemains: false };
      msg.deleted = true;
      return {
        ok: true,
        detail: "Slack message deleted",
        residualRemains: msg.mayHaveBeenCopied,
      };
    }
    case "uninstall_bot": {
      const bot = uniqueTarget(world.slack.bots, (b) => b.name === ids.name);
      if (!bot) return { ok: false, detail: "Bot missing", residualRemains: false };
      bot.installed = false;
      return { ok: true, detail: "Bot uninstalled", residualRemains: false };
    }
    case "remove_collaborator": {
      const index = world.github.collaborators.findIndex(
        (c) => c.repo === ids.repo && c.login === ids.login,
      );
      if (index < 0) return { ok: false, detail: "Exact collaborator missing", residualRemains: false };
      world.github.collaborators.splice(index, 1);
      return { ok: true, detail: `${ids.login} removed from ${ids.repo}`, residualRemains: false };
    }
    case "restore_branch_protection": {
      const bp = uniqueTarget(world.github.branchProtection,
        (b) => b.repo === ids.repo && b.branch === ids.branch,
      );
      if (!bp) return { ok: false, detail: "Branch protection missing", residualRemains: false };
      bp.requiredReviews = Number(expected.requiredReviews);
      return { ok: true, detail: `Required reviews restored to ${bp.requiredReviews}`, residualRemains: false };
    }
    case "revert_commit": {
      const commit = uniqueTarget(world.github.commits, (c) => c.repo === ids.repo && c.sha === ids.sha);
      if (!commit) return { ok: false, detail: "Commit missing", residualRemains: false };
      commit.reverted = true;
      return {
        ok: true,
        detail: "Revert commit applied on main (blob remains in history)",
        residualRemains: true,
      };
    }
    case "delete_repo_webhook": {
      const wh = uniqueTarget(world.github.webhooks, (w) => w.repo === ids.repo && w.url === ids.url);
      if (!wh) return { ok: false, detail: "Repo webhook missing", residualRemains: false };
      wh.active = false;
      return { ok: true, detail: "Attacker repo webhook deleted", residualRemains: false };
    }
    case "revoke_pat": {
      const pat = uniqueTarget(world.github.pats, (p) => p.id === ids.id);
      if (!pat) return { ok: false, detail: "PAT missing", residualRemains: false };
      pat.revoked = true;
      return { ok: true, detail: "PAT revoked", residualRemains: false };
    }
    case "make_repo_private": {
      const repo = uniqueTarget(world.github.repos, (r) => r.name === ids.name);
      if (!repo) return { ok: false, detail: "Repo missing", residualRemains: false };
      repo.visibility = "private";
      return {
        ok: true,
        detail: "internal-payroll set to private",
        residualRemains: repo.clonedUnknown,
      };
    }
    case "rotate_actions_secret": {
      const secret = uniqueTarget(world.github.secrets, (s) => s.repo === ids.repo && s.name === ids.name);
      if (!secret) return { ok: false, detail: "Secret missing", residualRemains: false };
      secret.fingerprint = "rotated-key-" + Date.now().toString(36);
      secret.rotated = true;
      return {
        ok: true,
        detail: "PRODUCTION_DEPLOY_KEY rotated (original value was not recoverable)",
        residualRemains: true,
      };
    }
    case "void_finalized_payment": {
      return {
        ok: false,
        detail: "Refusing to void a finalized payment — no magic undo",
        residualRemains: true,
      };
    }
    case "recall_exfil": {
      return {
        ok: false,
        detail: "Refusing to claim exfiltration recall",
        residualRemains: true,
      };
    }
    default:
      return { ok: false, detail: `No applicator for ${cmp.kind}`, residualRemains: true };
  }
}

/** Independently read the exact target after mutation; execution alone is never proof of repair. */
export function verifyCompensationPostcondition(world: World, cmp: Compensation): PostconditionResult {
  const spec = compensationSpecFor(cmp);
  if (!spec) return { holds: false, evidence: "invalid target-bound compensation descriptor" };
  const ids = spec.target.identifiers;
  const expected = spec.target.expected;
  let holds = false;
  switch (cmp.kind) {
    case "unassign_permission_set":
      holds = uniqueTargetSatisfies(world.salesforce.permissionSets, (p) => p.userId === ids.userId && p.name === ids.name, (p) => !p.assigned); break;
    case "unshare_report":
      holds = uniqueTargetSatisfies(world.salesforce.reports, (r) => r.id === ids.reportId, (r) => !r.sharedWith.includes(ids.principal!)); break;
    case "restore_sharing_rule":
      holds = uniqueTargetSatisfies(world.salesforce.sharing, (s) => s.object === ids.object, (s) => s.level === expected.level); break;
    case "delete_outbound_message":
      holds = uniqueTargetSatisfies(world.salesforce.outboundMessages, (o) => o.id === ids.id, (o) => !o.active); break;
    case "restore_contact_email":
      holds = uniqueTargetSatisfies(world.salesforce.contacts, (c) => c.id === ids.id, (c) => c.email === expected.email); break;
    case "deactivate_guest":
      holds = uniqueTargetSatisfies(world.slack.guests, (g) => g.email === ids.email, (g) => g.status === "deactivated"); break;
    case "revoke_public_file_link":
      holds = uniqueTargetSatisfies(world.slack.publicFileLinks, (f) => f.file === ids.file, (f) => !f.active); break;
    case "disable_incoming_webhook":
      holds = uniqueTargetSatisfies(world.slack.incomingWebhooks, (w) => w.id === ids.id, (w) => !w.active); break;
    case "delete_message":
      holds = uniqueTargetSatisfies(world.slack.messages, (m) => m.channel === ids.channel && m.ts === ids.ts, (m) => m.deleted); break;
    case "uninstall_bot":
      holds = uniqueTargetSatisfies(world.slack.bots, (b) => b.name === ids.name, (b) => !b.installed); break;
    case "remove_collaborator":
      holds = !world.github.collaborators.some((c) => c.repo === ids.repo && c.login === ids.login); break;
    case "restore_branch_protection":
      holds = uniqueTargetSatisfies(world.github.branchProtection, (b) => b.repo === ids.repo && b.branch === ids.branch, (b) => b.requiredReviews === expected.requiredReviews); break;
    case "revert_commit":
      holds = uniqueTargetSatisfies(world.github.commits, (c) => c.repo === ids.repo && c.sha === ids.sha, (c) => c.reverted); break;
    case "delete_repo_webhook":
      holds = uniqueTargetSatisfies(world.github.webhooks, (w) => w.repo === ids.repo && w.url === ids.url, (w) => !w.active); break;
    case "revoke_pat":
      holds = uniqueTargetSatisfies(world.github.pats, (p) => p.id === ids.id, (p) => p.revoked); break;
    case "make_repo_private":
      holds = uniqueTargetSatisfies(world.github.repos, (r) => r.name === ids.name, (r) => r.visibility === "private"); break;
    case "rotate_actions_secret":
      holds = uniqueTargetSatisfies(world.github.secrets, (s) => s.repo === ids.repo && s.name === ids.name, (s) => s.rotated && s.fingerprint !== s.snapshotFingerprint); break;
  }
  return {
    holds,
    evidence: `${spec.target.resource}:${Object.entries(ids).map(([key, value]) => `${key}=${value}`).join(",")}:expected=${JSON.stringify(expected)}:${holds ? "satisfied" : "unsatisfied"}`,
  };
}

export function simulateCompensation(world: World, cmp: Compensation): ApplyResult {
  return applyCompensation(world, cmp);
}
