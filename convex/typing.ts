import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { getClerkId } from "./auth";

const TYPING_ACTIVE_WINDOW_MS = 2_000;

async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  const clerkId = getClerkId(identity);

  if (!clerkId) {
    return null;
  }

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
}

async function assertMembership(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
) {
  const members = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect();

  return members.some((member) => member.userId === userId);
}

export const setTyping = mutation({
  args: {
    conversationId: v.id("conversations"),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);

    if (!currentUser) {
      return;
    }

    const isMember = await assertMembership(
      ctx,
      args.conversationId,
      currentUser._id,
    );

    if (!isMember) {
      return;
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("typingStates")
      .withIndex("by_user_conversation", (q) =>
        q
          .eq("userId", currentUser._id)
          .eq("conversationId", args.conversationId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isTyping: args.isTyping,
        updatedAt: now,
      });
      return;
    }

    await ctx.db.insert("typingStates", {
      conversationId: args.conversationId,
      userId: currentUser._id,
      isTyping: args.isTyping,
      updatedAt: now,
    });
  },
});

export const getForConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);

    if (!currentUser) {
      return null;
    }

    const isMember = await assertMembership(
      ctx,
      args.conversationId,
      currentUser._id,
    );

    if (!isMember) {
      return null;
    }

    const typingRows = await ctx.db
      .query("typingStates")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    const now = Date.now();
    const otherTypingRow = typingRows.find(
      (row) =>
        row.userId !== currentUser._id &&
        row.isTyping &&
        now - row.updatedAt <= TYPING_ACTIVE_WINDOW_MS,
    );

    if (!otherTypingRow) {
      return null;
    }

    const otherUser = await ctx.db.get(otherTypingRow.userId);
    if (!otherUser) {
      return null;
    }

    return {
      userId: otherUser._id,
      displayName: otherUser.displayName,
      updatedAt: otherTypingRow.updatedAt,
    };
  },
});
