import type { World } from "../world.js";

export function freezeIdentity(world: World): { locked: boolean; detail: string } {
  world.frozen = true;
  for (const token of world.tokens) {
    token.frozen = true;
  }
  return {
    locked: true,
    detail: `Identity ${world.identity.email} frozen; ${world.tokens.length} live sessions blocked from minting new API calls.`,
  };
}

export function revokeOAuth(world: World): { tokenIds: string[]; detail: string } {
  const tokenIds: string[] = [];
  for (const token of world.tokens) {
    token.revoked = true;
    tokenIds.push(token.id);
  }
  return {
    tokenIds,
    detail: `Revoked ${tokenIds.length} OAuth tokens (${tokenIds.join(", ")}). PATs, guests, collaborators, and webhooks are untouched.`,
  };
}

export function oauthTokenWorks(world: World, tokenId: string): boolean {
  const token = world.tokens.find((t) => t.id === tokenId);
  if (!token) return false;
  return !token.revoked && !token.frozen;
}
