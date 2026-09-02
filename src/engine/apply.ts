import type { Compensation } from "../types.js";
import { isAttackerUrl, isExternalEmail, type World } from "../world.js";

export interface ApplyResult {
  ok: boolean;
  detail: string;
  /** If true, the runner must not record a "fully undone" claim. */
  residualRemains: boolean;
}

/**
 * Apply a single compensation. Used both for simulation (on a clone)
 * and for real execution. Never "undoes" exfil or finalized payments.
 */
export function applyCompensation(world: World, cmp: Compensation): ApplyResult {
  switch (cmp.kind) {
    case "unassign_permission_set": {
      const row = world.salesforce.permissionSets.find(
        (p) => p.userId === world.identity.id && p.name === "Modify All Data",
      );
      if (!row) return { ok: false, detail: "Permission set row missing", residualRemains: false };
      row.assigned = false;
      return { ok: true, detail: "Unassigned Modify All Data", residualRemains: false };
    }
    case "unshare_report": {
      const report = world.salesforce.reports.find((r) => r.id === "q4-pipeline");
      if (!report) return { ok: false, detail: "Report missing", residualRemains: false };
      report.sharedWith = report.sharedWith.filter((e) => !isExternalEmail(e));
      return { ok: true, detail: "Removed external report shares", residualRemains: false };
    }
    case "restore_sharing_rule": {
      const rule = world.salesforce.sharing.find((s) => s.object === "Account");
      if (!rule) return { ok: false, detail: "Sharing rule missing", residualRemains: false };
      rule.level = rule.previousLevel;
      return { ok: true, detail: `Account OWD restored to ${rule.level}`, residualRemains: false };
    }
    case "delete_outbound_message": {
      const om = world.salesforce.outboundMessages.find((o) => o.id === "om-sf-exfil");
      if (!om) return { ok: false, detail: "Outbound message missing", residualRemains: false };
      om.active = false;
      return { ok: true, detail: "Outbound message deactivated", residualRemains: false };
    }
    case "restore_contact_email": {
      const c = world.salesforce.contacts.find((x) => x.id === "cfo");
      if (!c) return { ok: false, detail: "Contact missing", residualRemains: false };
      c.email = c.snapshotEmail;
      return {
        ok: true,
        detail: `CFO email restored to ${c.email}`,
        residualRemains: true,
      };
    }
    case "deactivate_guest": {
      const g = world.slack.guests.find((x) => x.email === "attacker@evil.example");
      if (!g) return { ok: false, detail: "Guest missing", residualRemains: false };
      g.status = "deactivated";
      return { ok: true, detail: "Guest deactivated", residualRemains: false };
    }
    case "revoke_public_file_link": {
      const link = world.slack.publicFileLinks.find((f) => f.file === "board-minutes.pdf");
      if (!link) return { ok: false, detail: "File link missing", residualRemains: false };
      link.active = false;
      return {
        ok: true,
        detail: "Public file link revoked",
        residualRemains: link.downloadsUnknown,
      };
    }
    case "disable_incoming_webhook": {
      const wh = world.slack.incomingWebhooks.find((w) => w.id === "wh-alerts");
      if (!wh) return { ok: false, detail: "Webhook missing", residualRemains: false };
      wh.active = false;
      return { ok: true, detail: "Incoming webhook disabled", residualRemains: false };
    }
    case "delete_message": {
      const msg = world.slack.messages.find((m) => m.channel === "#general");
      if (!msg) return { ok: false, detail: "Message missing", residualRemains: false };
      msg.deleted = true;
      return {
        ok: true,
        detail: "Slack message deleted",
        residualRemains: msg.mayHaveBeenCopied,
      };
    }
    case "uninstall_bot": {
      const bot = world.slack.bots.find((b) => b.name === "Helpful Sync");
      if (!bot) return { ok: false, detail: "Bot missing", residualRemains: false };
      bot.installed = false;
      return { ok: true, detail: "Bot uninstalled", residualRemains: false };
    }
    case "remove_collaborator": {
      world.github.collaborators = world.github.collaborators.filter(
        (c) => !(c.repo === "payments-api" && c.login === "attacker-bot"),
      );
      return { ok: true, detail: "attacker-bot removed", residualRemains: false };
    }
    case "restore_branch_protection": {
      const bp = world.github.branchProtection.find(
        (b) => b.repo === "payments-api" && b.branch === "main",
      );
      if (!bp) return { ok: false, detail: "Branch protection missing", residualRemains: false };
      bp.requiredReviews = bp.snapshotReviews;
      return { ok: true, detail: `Required reviews restored to ${bp.requiredReviews}`, residualRemains: false };
    }
    case "revert_commit": {
      const commit = world.github.commits.find((c) => c.sha === "c0ffee");
      if (!commit) return { ok: false, detail: "Commit missing", residualRemains: false };
      commit.reverted = true;
      return {
        ok: true,
        detail: "Revert commit applied on main (blob remains in history)",
        residualRemains: true,
      };
    }
    case "delete_repo_webhook": {
      const wh = world.github.webhooks.find((w) => isAttackerUrl(w.url));
      if (!wh) return { ok: false, detail: "Repo webhook missing", residualRemains: false };
      wh.active = false;
      return { ok: true, detail: "Attacker repo webhook deleted", residualRemains: false };
    }
    case "revoke_pat": {
      const pat = world.github.pats.find((p) => p.id === "pat-alex-breakglass");
      if (!pat) return { ok: false, detail: "PAT missing", residualRemains: false };
      pat.revoked = true;
      return { ok: true, detail: "PAT revoked", residualRemains: false };
    }
    case "make_repo_private": {
      const repo = world.github.repos.find((r) => r.name === "internal-payroll");
      if (!repo) return { ok: false, detail: "Repo missing", residualRemains: false };
      repo.visibility = "private";
      return {
        ok: true,
        detail: "internal-payroll set to private",
        residualRemains: repo.clonedUnknown,
      };
    }
    case "rotate_actions_secret": {
      const secret = world.github.secrets.find((s) => s.name === "PRODUCTION_DEPLOY_KEY");
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

export function simulateCompensation(world: World, cmp: Compensation): ApplyResult {
  return applyCompensation(world, cmp);
}
