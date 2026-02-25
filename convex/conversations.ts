import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
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

type ConversationSummary = {
  _id: Id<"conversations">;
  updatedAt: number;
  createdAt: number;
  lastMessageText?: string;
  lastMessageAt?: number;
  unreadCount: number;
  type: "direct" | "group";
  title: string;
  memberCount: number;
  otherUser?: {
    _id: Id<"users">;
    displayName: string;
    imageUrl?: string;
    isOnline: boolean;
    lastSeenAt?: number;
  };
};

async function buildConversationSummary(
  ctx: QueryCtx,
  conversationId: Id<"conversations">,
  currentUserId: Id<"users">,
): Promise<ConversationSummary | null> {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation) {
    return null;
  }

  const members = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect();

  const readState = await ctx.db
    .query("conversationReads")
    .withIndex("by_conversation_user", (q) =>
      q.eq("conversationId", conversationId).eq("userId", currentUserId),
    )
    .unique();

  const lastReadAt = readState?.lastReadAt ?? 0;
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_conversation_created_at", (q) =>
      lastReadAt > 0
        ? q.eq("conversationId", conversationId).gt("createdAt", lastReadAt)
        : q.eq("conversationId", conversationId),
    )
    .collect();

  const unreadCount = messages.filter(
    (message) =>
      message.senderId !== currentUserId &&
      !message.isDeleted &&
      message.createdAt > lastReadAt,
  ).length;

  if (conversation.type === "direct") {
    const otherMember = members.find(
      (member) => member.userId !== currentUserId,
    );
    if (!otherMember) {
      return null;
    }

    const otherUser = await ctx.db.get(otherMember.userId);
    if (!otherUser) {
      return null;
    }

    return {
      _id: conversation._id,
      updatedAt: conversation.updatedAt,
      createdAt: conversation.createdAt,
      lastMessageText: conversation.lastMessageText,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount,
      type: "direct",
      title: otherUser.displayName,
      memberCount: members.length,
      otherUser: {
        _id: otherUser._id,
        displayName: otherUser.displayName,
        imageUrl: otherUser.imageUrl,
        isOnline: isUserOnline(otherUser.lastSeenAt, otherUser.isOnline),
        lastSeenAt: otherUser.lastSeenAt,
      },
    };
  }

  return {
    _id: conversation._id,
    updatedAt: conversation.updatedAt,
    createdAt: conversation.createdAt,
    lastMessageText: conversation.lastMessageText,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount,
    type: "group",
    title: conversation.groupName ?? "Untitled Group",
    memberCount: members.length,
  };
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

export const createGroupConversation = mutation({
  args: {
    name: v.string(),
    memberIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    const name = args.name.trim();
    if (!name) {
      throw new Error("Group name is required");
    }

    const uniqueMembers = Array.from(
      new Set(args.memberIds.map((id) => String(id))),
    ).map((id) => id as Id<"users">);

    const members = uniqueMembers.includes(currentUser._id)
      ? uniqueMembers
      : [...uniqueMembers, currentUser._id];

    if (members.length < 3) {
      throw new Error("Select at least 2 members to create a group");
    }

    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      type: "group",
      groupName: name,
      createdAt: now,
      updatedAt: now,
    });

    await Promise.all(
      members.map(async (userId) => {
        const user = await ctx.db.get(userId);
        if (!user) {
          return;
        }

        await ctx.db.insert("conversationMembers", {
          conversationId,
          userId,
          joinedAt: now,
        });
      }),
    );

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

    const summaries = await Promise.all(
      memberships.map((membership) =>
        buildConversationSummary(
          ctx,
          membership.conversationId,
          currentUser._id,
        ),
      ),
    );

    return summaries
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

    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("userId", currentUser._id),
      )
      .unique();

    if (!membership) {
      return null;
    }

    const summary = await buildConversationSummary(
      ctx,
      args.conversationId,
      currentUser._id,
    );

    if (!summary) {
      return null;
    }

    return {
      conversationId: args.conversationId,
      type: summary.type,
      title: summary.title,
      memberCount: summary.memberCount,
      updatedAt: summary.updatedAt,
      lastMessageText: summary.lastMessageText,
      lastMessageAt: summary.lastMessageAt,
      otherUser: summary.otherUser,
    };
  },
});
