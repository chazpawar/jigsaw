import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { getClerkId } from "./auth";

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

async function upsertReadState(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
  lastReadAt: number,
) {
  const existingReadState = await ctx.db
    .query("conversationReads")
    .withIndex("by_conversation_user", (q) =>
      q.eq("conversationId", conversationId).eq("userId", userId),
    )
    .unique();

  if (existingReadState) {
    await ctx.db.patch(existingReadState._id, {
      lastReadAt,
    });
    return;
  }

  await ctx.db.insert("conversationReads", {
    conversationId,
    userId,
    lastReadAt,
  });
}

export const listForConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);

    if (!currentUser) {
      return [];
    }

    const isMember = await assertMembership(
      ctx,
      args.conversationId,
      currentUser._id,
    );

    if (!isMember) {
      return [];
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created_at", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    return messages.map((message) => ({
      _id: message._id,
      senderId: message.senderId,
      body: message.body,
      createdAt: message.createdAt,
      isMine: message.senderId === currentUser._id,
    }));
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);

    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    const body = args.body.trim();
    if (!body) {
      throw new Error("Message cannot be empty");
    }

    const isMember = await assertMembership(
      ctx,
      args.conversationId,
      currentUser._id,
    );

    if (!isMember) {
      throw new Error("Forbidden");
    }

    const createdAt = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: currentUser._id,
      body,
      createdAt,
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: createdAt,
      lastMessageText: body,
      lastMessageAt: createdAt,
      lastMessageSenderId: currentUser._id,
    });

    await upsertReadState(ctx, args.conversationId, currentUser._id, createdAt);

    const typingState = await ctx.db
      .query("typingStates")
      .withIndex("by_user_conversation", (q) =>
        q
          .eq("userId", currentUser._id)
          .eq("conversationId", args.conversationId),
      )
      .unique();

    if (typingState) {
      await ctx.db.patch(typingState._id, {
        isTyping: false,
        updatedAt: createdAt,
      });
    }

    return messageId;
  },
});

export const markConversationRead = mutation({
  args: {
    conversationId: v.id("conversations"),
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

    await upsertReadState(
      ctx,
      args.conversationId,
      currentUser._id,
      Date.now(),
    );
  },
});
