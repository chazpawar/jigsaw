import type { UserIdentity } from "convex/server";

export function getClerkId(identity: UserIdentity | null) {
  if (!identity) {
    return null;
  }

  if (identity.subject) {
    return identity.subject;
  }

  const segments = identity.tokenIdentifier.split("|");
  return segments[segments.length - 1] ?? null;
}
