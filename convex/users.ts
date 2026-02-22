import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getClerkId } from "./auth";

const ONLINE_WINDOW_MS = 30_000;

function isUserOnline(lastSeenAt?: number, isOnline?: boolean) {
  if (!isOnline || !lastSeenAt) {
    return false;
  }

  return Date.now() - lastSeenAt < ONLINE_WINDOW_MS;
}

export const upsertFromClerk = mutation({
  args: {
    displayName: v.string(),
    imageUrl: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = getClerkId(identity);

    if (!clerkId) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: args.displayName,
        imageUrl: args.imageUrl,
        email: args.email,
        isOnline: true,
        lastSeenAt: now,
      });

      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId,
      displayName: args.displayName,
      imageUrl: args.imageUrl,
      email: args.email,
      isOnline: true,
      lastSeenAt: now,
    });
  },
});

export const searchUsers = query({
  args: {
    searchTerm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const currentClerkId = getClerkId(identity);

    if (!currentClerkId) {
      return [];
    }

    const normalizedSearch = args.searchTerm?.trim().toLowerCase() ?? "";
    const users = await ctx.db.query("users").collect();

    return users
      .filter((user) => user.clerkId !== currentClerkId)
      .filter((user) => {
        if (!normalizedSearch) {
          return true;
        }

        return user.displayName.toLowerCase().includes(normalizedSearch);
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .slice(0, 20)
      .map((user) => ({
        _id: user._id,
        displayName: user.displayName,
        imageUrl: user.imageUrl,
        isOnline: isUserOnline(user.lastSeenAt, user.isOnline),
        lastSeenAt: user.lastSeenAt,
      }));
  },
});

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = getClerkId(identity);

    if (!clerkId) {
      return;
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (!existing) {
      return;
    }

    await ctx.db.patch(existing._id, {
      isOnline: true,
      lastSeenAt: Date.now(),
    });
  },
});

export const setOffline = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = getClerkId(identity);

    if (!clerkId) {
      return;
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (!existing) {
      return;
    }

    await ctx.db.patch(existing._id, {
      isOnline: false,
      lastSeenAt: Date.now(),
    });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkId = getClerkId(identity);

    if (!clerkId) {
      return null;
    }

    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
  },
});
