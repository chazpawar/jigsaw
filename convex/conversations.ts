import { v } from "convex/values";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { getClerkId } from "./auth";

const ONLINE_WINDOW_MS = 30_000;

function isUserOnline(lastSeenAt?: number, isOnline?: boolean) {
  if (!isOnline || !lastSeenAt) {
    return false;
  }

  return Date.now() - lastSeenAt < ONLINE_WINDOW_MS;
}

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

function makeDirectKey(userIdA: string, userIdB: string) {
  return [userIdA, userIdB].sort().join("::");
}

export const openOrCreateDirectConversation = mutation({
  args: {
    peerUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);

    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    if (currentUser._id === args.peerUserId) {
      throw new Error("Cannot create conversation with yourself");
    }

    const peerUser = await ctx.db.get(args.peerUserId);
    if (!peerUser) {
      throw new Error("User not found");
    }

    const directKey = makeDirectKey(
      String(currentUser._id),
      String(peerUser._id),
    );
    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_direct_key", (q) => q.eq("directKey", directKey))
      .unique();

    const now = Date.now();

    if (existingConversation) {
      await ctx.db.patch(existingConversation._id, {
        updatedAt: now,
      });

      return existingConversation._id;
    }

    const conversationId = await ctx.db.insert("conversations", {
      type: "direct",
      directKey,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: currentUser._id,
      joinedAt: now,
    });

    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: peerUser._id,
      joinedAt: now,
    });

    return conversationId;
  },
});

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);

    if (!currentUser) {
      return [];
    }

    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();

    const rows = await Promise.all(
      memberships.map(async (membership) => {
        const conversation = await ctx.db.get(membership.conversationId);
        if (!conversation) {
          return null;
        }

        const members = await ctx.db
          .query("conversationMembers")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", membership.conversationId),
          )
          .collect();

        const otherMember = members.find(
          (member) => member.userId !== currentUser._id,
        );
        if (!otherMember) {
          return null;
        }

        const otherUser = await ctx.db.get(otherMember.userId);
        if (!otherUser) {
          return null;
        }

        const readState = await ctx.db
          .query("conversationReads")
          .withIndex("by_conversation_user", (q) =>
            q
              .eq("conversationId", membership.conversationId)
              .eq("userId", currentUser._id),
          )
          .unique();

        const lastReadAt = readState?.lastReadAt ?? 0;
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_conversation_created_at", (q) =>
            q.eq("conversationId", membership.conversationId),
          )
          .collect();

        const unreadCount = messages.filter(
          (message) =>
            message.senderId !== currentUser._id &&
            message.createdAt > lastReadAt,
        ).length;

        return {
          _id: conversation._id,
          updatedAt: conversation.updatedAt,
          createdAt: conversation.createdAt,
          lastMessageText: conversation.lastMessageText,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount,
          otherUser: {
            _id: otherUser._id,
            displayName: otherUser.displayName,
            imageUrl: otherUser.imageUrl,
            isOnline: isUserOnline(otherUser.lastSeenAt, otherUser.isOnline),
            lastSeenAt: otherUser.lastSeenAt,
          },
        };
      }),
    );

    return rows
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const getConversationOverview = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);

    if (!currentUser) {
      return null;
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    const isMember = membership.some(
      (member) => member.userId === currentUser._id,
    );
    if (!isMember) {
      return null;
    }

    const otherMember = membership.find(
      (member) => member.userId !== currentUser._id,
    );
    if (!otherMember) {
      return null;
    }

    const otherUser = await ctx.db.get(otherMember.userId);
    if (!otherUser) {
      return null;
    }

    return {
      conversationId: args.conversationId,
      updatedAt: conversation.updatedAt,
      lastMessageText: conversation.lastMessageText,
      lastMessageAt: conversation.lastMessageAt,
      otherUser: {
        _id: otherUser._id,
        displayName: otherUser.displayName,
        imageUrl: otherUser.imageUrl,
        isOnline: isUserOnline(otherUser.lastSeenAt, otherUser.isOnline),
        lastSeenAt: otherUser.lastSeenAt,
      },
    };
  },
});
