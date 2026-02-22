import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    displayName: v.string(),
    imageUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    isOnline: v.boolean(),
    lastSeenAt: v.optional(v.number()),
  }).index("by_clerk_id", ["clerkId"]),
});
