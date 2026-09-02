import type { Identity, TenantId, Token } from "./types.js";

export const COMPROMISED: Identity = {
  id: "id-alex-chen",
  email: "alex.chen@acme.example",
  displayName: "Alex Chen",
  role: "RevOps + platform admin (over-scoped)",
};

export const ATTACKER_DOMAINS = [
  "exfil.attacker.example",
  "evil.example",
  "drop.attacker.example",
];

export function isAttackerUrl(url: string): boolean {
  return ATTACKER_DOMAINS.some((d) => url.includes(d));
}

export function isExternalEmail(email: string): boolean {
  return !email.endsWith("@acme.example");
}

export interface SalesforceWorld {
  reports: Array<{
    id: string;
    name: string;
    sharedWith: string[];
  }>;
  sharing: Array<{ object: string; level: string; previousLevel: string }>;
  outboundMessages: Array<{ id: string; url: string; active: boolean }>;
  permissionSets: Array<{ userId: string; name: string; assigned: boolean }>;
  contacts: Array<{
    id: string;
    name: string;
    email: string;
    snapshotEmail: string;
  }>;
  payments: Array<{
    id: string;
    amountUsd: number;
    vendor: string;
    status: "draft" | "finalized";
    postedAt: string;
  }>;
  exports: Array<{
    id: string;
    dataset: string;
    rows: number;
    destination: string;
    completedAt: string;
  }>;
}

export interface SlackWorld {
  guests: Array<{
    email: string;
    status: "active" | "deactivated";
    channel: string;
  }>;
  publicFileLinks: Array<{
    file: string;
    url: string;
    active: boolean;
    downloadsUnknown: boolean;
  }>;
  incomingWebhooks: Array<{ id: string; url: string; active: boolean }>;
  messages: Array<{
    channel: string;
    ts: string;
    text: string;
    deleted: boolean;
    mayHaveBeenCopied: boolean;
  }>;
  bots: Array<{ name: string; scopes: string[]; installed: boolean }>;
}

export interface GitHubWorld {
  collaborators: Array<{
    repo: string;
    login: string;
    role: "admin" | "write" | "read";
    addedBy: string;
  }>;
  commits: Array<{
    repo: string;
    sha: string;
    message: string;
    reverted: boolean;
    containsDump: boolean;
  }>;
  webhooks: Array<{ repo: string; url: string; active: boolean }>;
  branchProtection: Array<{
    repo: string;
    branch: string;
    requiredReviews: number;
    snapshotReviews: number;
  }>;
  pats: Array<{
    id: string;
    login: string;
    scopes: string[];
    revoked: boolean;
  }>;
  repos: Array<{
    name: string;
    visibility: "private" | "public";
    snapshotVisibility: "private" | "public";
    clonedUnknown: boolean;
  }>;
  secrets: Array<{
    repo: string;
    name: string;
    fingerprint: string;
    rotated: boolean;
    snapshotFingerprint: string;
  }>;
}

export interface World {
  identity: Identity;
  frozen: boolean;
  tokens: Token[];
  salesforce: SalesforceWorld;
  slack: SlackWorld;
  github: GitHubWorld;
  /** Audit of executed compensations against this world. */
  executedCompensations: string[];
  /** Claims that an effect was fully undone (used to detect false undo positives). */
  claimedFullyUndone: string[];
}

export function emptyTokens(identityId: string): Token[] {
  const issuedAt = "2026-08-28T09:00:00.000Z";
  const tenants: TenantId[] = ["salesforce", "slack", "github"];
  return tenants.map((tenant) => ({
    id: `tok-${tenant}-alex-2026`,
    identityId,
    tenant,
    issuedAt,
    scopes: ["full"],
    revoked: false,
    frozen: false,
  }));
}

export function cloneWorld(world: World): World {
  return structuredClone(world);
}
