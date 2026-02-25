import type { Id } from "@convex/_generated/dataModel";

export type DiscoverableUser = {
  _id: Id<"users">;
  displayName: string;
  imageUrl?: string;
  email?: string;
  isOnline: boolean;
  lastSeenAt?: number;
};

export type SidebarConversation = {
  _id: Id<"conversations">;
  type: "direct" | "group";
  title: string;
  memberCount: number;
  updatedAt: number;
  lastMessageText?: string;
  lastMessageAt?: number;
  unreadCount: number;
  otherUser?: DiscoverableUser;
};

export type ConversationOverview = {
  conversationId: Id<"conversations">;
  type: "direct" | "group";
  title: string;
  memberCount: number;
  otherUser?: DiscoverableUser;
};

export type Message = {
  _id: Id<"messages">;
  senderId: Id<"users">;
  senderName: string;
  body: string;
  createdAt: number;
  replyToMessageId?: Id<"messages">;
  replyToSenderName?: string;
  replyToBody?: string;
  attachmentUrl?: string | null;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  isMine: boolean;
  isDeleted: boolean;
  deletedAt?: number;
  reactions: Array<{
    emoji: "👍" | "❤️" | "😂" | "😮" | "😢";
    count: number;
    reactedByMe: boolean;
  }>;
};

export type TypingState = {
  displayName: string;
  updatedAt: number;
};

export type ForwardPayload = {
  body: string;
  attachmentUrl?: string | null;
  attachmentName?: string;
};

export type ReplyTarget = {
  messageId: Id<"messages">;
  senderName: string;
  preview: string;
};
