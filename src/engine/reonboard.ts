import type { Identity } from "../types.js";
import type { World } from "../world.js";

const LEAST_PRIVILEGE_SCOPES = [
  "salesforce:read_own",
  "slack:channels:read",
  "github:repo:read",
] as const;

export function reonboardLeastPrivilege(world: World): {
  newIdentity: Identity;
  newTokenIds: string[];
  leastPrivilege: boolean;
  scopes: string[];
  detail: string;
} {
  const newIdentity: Identity = {
    id: "id-alex-chen-recovered",
    email: world.identity.email,
    displayName: world.identity.displayName,
    role: "RevOps analyst (least privilege)",
  };

  const issuedAt = new Date().toISOString();
  const newTokens = LEAST_PRIVILEGE_SCOPES.map((scope) => {
    const tenant = scope.startsWith("salesforce")
      ? "salesforce"
      : scope.startsWith("slack")
        ? "slack"
        : "github";
    return {
      id: `tok-${tenant}-alex-recovered`,
      identityId: newIdentity.id,
      tenant: tenant as "salesforce" | "slack" | "github",
      issuedAt,
      scopes: [scope] as string[],
      revoked: false,
      frozen: false,
    };
  });

  // Old tokens must remain revoked. New tokens are additional.
  world.tokens.push(...newTokens);

  const oldStillLive = world.tokens.some(
    (t) => t.identityId === world.identity.id && !t.revoked && !t.frozen,
  );
  const overScoped = newTokens.some(
    (t) => t.scopes.some((s) => s === "full" || s === "admin:org" || s === "Modify All Data"),
  );

  return {
    newIdentity,
    newTokenIds: newTokens.map((t) => t.id),
    leastPrivilege: !oldStillLive && !overScoped,
    scopes: [...LEAST_PRIVILEGE_SCOPES],
    detail: oldStillLive
      ? "FAILED: old OAuth still live during re-onboard"
      : `Issued ${newTokens.length} least-privilege tokens; old OAuth remains revoked.`,
  };
}

export function recoveredTokenWorks(world: World, tokenId: string): boolean {
  const token = world.tokens.find((t) => t.id === tokenId);
  if (!token) return false;
  if (token.revoked || token.frozen) return false;
  return token.identityId === "id-alex-chen-recovered";
}
