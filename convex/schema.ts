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

  conversations: defineTable({
    type: v.literal("direct"),
    directKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastMessageText: v.optional(v.string()),
    lastMessageAt: v.optional(v.number()),
    lastMessageSenderId: v.optional(v.id("users")),
  })
    .index("by_direct_key", ["directKey"])
    .index("by_updated_at", ["updatedAt"]),

  conversationMembers: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_conversation", ["conversationId"]),

  conversationReads: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    lastReadAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_conversation_user", ["conversationId", "userId"]),

  typingStates: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    updatedAt: v.number(),
    isTyping: v.boolean(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user_conversation", ["userId", "conversationId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_conversation_created_at", ["conversationId", "createdAt"]),
});
