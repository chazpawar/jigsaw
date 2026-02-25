import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { getClerkId } from "./auth";

const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "😮", "😢"] as const;

type AllowedReaction = (typeof ALLOWED_REACTIONS)[number];

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
  const member = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation_user", (q) =>
      q.eq("conversationId", conversationId).eq("userId", userId),
    )
    .unique();

  return Boolean(member);
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
    await ctx.db.patch(existingReadState._id, { lastReadAt });
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

    return await Promise.all(
      messages.map(async (message) => {
        const reactions = await ctx.db
          .query("messageReactions")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .collect();

        const reactionGroups = ALLOWED_REACTIONS.map((emoji) => {
          const grouped = reactions.filter(
            (reaction) => reaction.emoji === emoji,
          );
          return {
            emoji,
            count: grouped.length,
            reactedByMe: grouped.some(
              (reaction) => reaction.userId === currentUser._id,
            ),
          };
        }).filter((group) => group.count > 0);

        const topReaction = reactionGroups.reduce<{
          emoji: AllowedReaction;
          count: number;
          reactedByMe: boolean;
        } | null>((current, group) => {
          if (!current || group.count > current.count) {
            return group;
          }

          return current;
        }, null);

        return {
          _id: message._id,
          senderId: message.senderId,
          senderName: message.senderName ?? "Unknown",
          body: message.body,
          createdAt: message.createdAt,
          replyToMessageId: message.replyToMessageId,
          replyToSenderName: message.replyToSenderName,
          replyToBody: message.replyToBody,
          attachmentUrl: message.attachmentStorageId
            ? await ctx.storage.getUrl(message.attachmentStorageId)
            : null,
          attachmentName: message.attachmentName,
          attachmentMimeType: message.attachmentMimeType,
          attachmentSize: message.attachmentSize,
          isMine: message.senderId === currentUser._id,
          isDeleted: message.isDeleted ?? false,
          deletedAt: message.deletedAt,
          reactions: topReaction ? [topReaction] : [],
        };
      }),
    );
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.optional(v.string()),
    replyToMessageId: v.optional(v.id("messages")),
    replyToSenderName: v.optional(v.string()),
    replyToBody: v.optional(v.string()),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentName: v.optional(v.string()),
    attachmentMimeType: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);

    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    const body = args.body?.trim() ?? "";
    const hasAttachment = Boolean(args.attachmentStorageId);

    if (!body && !hasAttachment) {
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
      senderName: currentUser.displayName,
      body,
      createdAt,
      replyToMessageId: args.replyToMessageId,
      replyToSenderName: args.replyToSenderName,
      replyToBody: args.replyToBody,
      attachmentStorageId: args.attachmentStorageId,
      attachmentName: args.attachmentName,
      attachmentMimeType: args.attachmentMimeType,
      attachmentSize: args.attachmentSize,
      isDeleted: false,
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: createdAt,
      lastMessageText: body || args.attachmentName || "Attachment",
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

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    return await ctx.storage.generateUploadUrl();
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

export const softDelete = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    if (message.senderId !== currentUser._id) {
      throw new Error("You can only delete your own messages");
    }

    if (message.isDeleted) {
      return;
    }

    const deletedAt = Date.now();
    await ctx.db.patch(message._id, {
      isDeleted: true,
      body: "This message was deleted",
      deletedAt,
    });

    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation) {
      return;
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created_at", (q) =>
        q.eq("conversationId", message.conversationId),
      )
      .collect();

    const latest = messages[messages.length - 1];
    if (!latest) {
      return;
    }

    await ctx.db.patch(message.conversationId, {
      updatedAt: Math.max(conversation.updatedAt, deletedAt),
      lastMessageText: latest.body,
      lastMessageAt: latest.createdAt,
      lastMessageSenderId: latest.senderId,
    });
  },
});

export const toggleReaction = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.union(
      v.literal("👍"),
      v.literal("❤️"),
      v.literal("😂"),
      v.literal("😮"),
      v.literal("😢"),
    ),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    const isMember = await assertMembership(
      ctx,
      message.conversationId,
      currentUser._id,
    );
    if (!isMember) {
      throw new Error("Forbidden");
    }

    if (!(ALLOWED_REACTIONS as readonly string[]).includes(args.emoji)) {
      throw new Error("Unsupported reaction");
    }

    const existing = await ctx.db
      .query("messageReactions")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();

    const existingEmoji = existing[0]?.emoji ?? null;
    const hasSameEmoji = existingEmoji === args.emoji;
    const existingForUser = existing.filter(
      (reaction) => reaction.userId === currentUser._id,
    );
    const matching = existingForUser.find(
      (reaction) => reaction.emoji === args.emoji,
    );

    if (hasSameEmoji) {
      if (matching) {
        await ctx.db.delete(matching._id);
        return;
      }

      await ctx.db.insert("messageReactions", {
        messageId: args.messageId,
        userId: currentUser._id,
        emoji: args.emoji as AllowedReaction,
      });
      return;
    }

    for (const reaction of existing) {
      await ctx.db.delete(reaction._id);
    }

    await ctx.db.insert("messageReactions", {
      messageId: args.messageId,
      userId: currentUser._id,
      emoji: args.emoji as AllowedReaction,
    });
  },
});
