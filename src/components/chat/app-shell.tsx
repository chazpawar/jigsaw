"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMessageTimestamp } from "@/lib/time";

const ONLINE_WINDOW_MS = 30_000;
const AUTO_SCROLL_THRESHOLD = 48;
const REACTION_SET = ["👍", "❤️", "😂", "😮", "😢"] as const;

function isOnlineNow(lastSeenAt?: number, isOnline?: boolean) {
  if (!isOnline || !lastSeenAt) {
    return false;
  }

  return Date.now() - lastSeenAt < ONLINE_WINDOW_MS;
}

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function UserAvatar({ name, imageUrl }: { name: string; imageUrl?: string }) {
  const fallback = name.slice(0, 1).toUpperCase();

  if (imageUrl) {
    return (
      <div
        role="img"
        aria-label={name}
        className="size-9 rounded-full bg-cover bg-center"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
    );
  }

  return (
    <div className="flex size-9 items-center justify-center rounded-full bg-neutral-700 text-xs font-semibold text-neutral-100">
      {fallback}
    </div>
  );
}

type DiscoverableUser = {
  _id: Id<"users">;
  displayName: string;
  imageUrl?: string;
  email?: string;
  isOnline: boolean;
  lastSeenAt?: number;
};

type SidebarConversation = {
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

type ConversationOverview = {
  conversationId: Id<"conversations">;
  type: "direct" | "group";
  title: string;
  memberCount: number;
  otherUser?: DiscoverableUser;
};

type Message = {
  _id: Id<"messages">;
  senderId: Id<"users">;
  senderName: string;
  body: string;
  createdAt: number;
  isMine: boolean;
  isDeleted: boolean;
  deletedAt?: number;
  reactions: Array<{
    emoji: "👍" | "❤️" | "😂" | "😮" | "😢";
    count: number;
    reactedByMe: boolean;
  }>;
};

type TypingState = {
  displayName: string;
  updatedAt: number;
};

export function AppShell() {
  const { user, isLoaded } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [selectedConversationId, setSelectedConversationId] =
    useState<Id<"conversations"> | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [presenceTick, setPresenceTick] = useState(0);
  const [unseenIncomingCount, setUnseenIncomingCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [conversationActionError, setConversationActionError] = useState<
    string | null
  >(null);
  const [failedMessageDraft, setFailedMessageDraft] = useState<string | null>(
    null,
  );
  const [groupName, setGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<
    Id<"users">[]
  >([]);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const messageScrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const previousMessageCountRef = useRef(0);

  const upsertFromClerk = useMutation(api.users.upsertFromClerk);
  const heartbeat = useMutation(api.users.heartbeat);
  const setOffline = useMutation(api.users.setOffline);
  const openOrCreateConversation = useMutation(
    api.conversations.openOrCreateDirectConversation,
  );
  const sendMessage = useMutation(api.messages.send);
  const softDeleteMessage = useMutation(api.messages.softDelete);
  const toggleReaction = useMutation(api.messages.toggleReaction);
  const markConversationRead = useMutation(api.messages.markConversationRead);
  const setTyping = useMutation(api.typing.setTyping);
  const createGroupConversation = useMutation(
    api.conversations.createGroupConversation,
  );

  const discoverableUsersResult = useQuery(api.users.searchUsers, {
    searchTerm,
  });
  const conversationsResult = useQuery(api.conversations.listForCurrentUser);
  const selectedConversationResult = useQuery(
    api.conversations.getConversationOverview,
    selectedConversationId
      ? { conversationId: selectedConversationId }
      : "skip",
  ) as ConversationOverview | null | undefined;
  const messagesResult = useQuery(
    api.messages.listForConversation,
    selectedConversationId
      ? { conversationId: selectedConversationId }
      : "skip",
  ) as Message[] | undefined;
  const typingStateResult = useQuery(
    api.typing.getForConversation,
    selectedConversationId
      ? { conversationId: selectedConversationId }
      : "skip",
  ) as TypingState | null | undefined;

  const discoverableUsers = (discoverableUsersResult ??
    []) as DiscoverableUser[];
  const conversations = (conversationsResult ?? []) as SidebarConversation[];
  const selectedConversation = selectedConversationResult;
  const messages = (messagesResult ?? []) as Message[];
  const typingState = typingStateResult;

  const isDiscoverableUsersLoading = discoverableUsersResult === undefined;
  const isConversationsLoading = conversationsResult === undefined;
  const isMessagesLoading =
    Boolean(selectedConversationId) && messagesResult === undefined;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPresenceTick((value) => value + 1);
    }, 1_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isLoaded || !user) {
      return;
    }

    const primaryEmail = user.primaryEmailAddress?.emailAddress;

    void upsertFromClerk({
      displayName: user.fullName ?? user.username ?? "Anonymous User",
      imageUrl: user.imageUrl,
      email: primaryEmail,
    });

    void heartbeat({});

    const heartbeatInterval = window.setInterval(() => {
      void heartbeat({});
    }, 10_000);

    const offlineHandler = () => {
      void setOffline({});
    };

    const visibilityHandler = () => {
      if (document.visibilityState === "hidden") {
        offlineHandler();
      }
    };

    window.addEventListener("beforeunload", offlineHandler);
    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      window.clearInterval(heartbeatInterval);
      window.removeEventListener("beforeunload", offlineHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
      offlineHandler();
    };
  }, [heartbeat, isLoaded, setOffline, upsertFromClerk, user]);

  useEffect(() => {
    if (selectedConversationId || conversations.length === 0) {
      return;
    }

    setSendError(null);
    setFailedMessageDraft(null);
    setSelectedConversationId(conversations[0]?._id ?? null);
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    const messageCount = messages.length;
    void messageCount;

    void markConversationRead({ conversationId: selectedConversationId });
  }, [markConversationRead, messages, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    const container = messageScrollRef.current;
    if (!container) {
      return;
    }

    const previous = previousMessageCountRef.current;
    const current = messages.length;
    const hasIncoming = current > previous;
    previousMessageCountRef.current = current;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const atBottom = distanceFromBottom <= AUTO_SCROLL_THRESHOLD;

    if (!hasIncoming || atBottom) {
      container.scrollTop = container.scrollHeight;
      setUnseenIncomingCount(0);
      return;
    }

    setUnseenIncomingCount((count) => count + (current - previous));
  }, [messages, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (!draftMessage.trim()) {
      void setTyping({
        conversationId: selectedConversationId,
        isTyping: false,
      });
      return;
    }

    void setTyping({ conversationId: selectedConversationId, isTyping: true });

    typingTimeoutRef.current = window.setTimeout(() => {
      void setTyping({
        conversationId: selectedConversationId,
        isTyping: false,
      });
    }, 1_800);

    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [draftMessage, selectedConversationId, setTyping]);

  useEffect(() => {
    if (!typingState) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setPresenceTick((value) => value + 1);
    }, 2_000);

    return () => window.clearTimeout(timeout);
  }, [typingState]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const hasSearch = normalizedSearchTerm.length > 0;
  const hasValidSearchEmail = isValidEmailAddress(normalizedSearchTerm);
  const matchedUser = discoverableUsers[0] ?? null;
  const canSendInvite = hasValidSearchEmail && !matchedUser;
  const selectedConversationLabel =
    selectedConversation?.title ?? "Select a conversation";

  const currentConversation = useMemo(() => {
    if (!selectedConversationId) {
      return null;
    }

    return (
      conversations.find(
        (conversation) => conversation._id === selectedConversationId,
      ) ?? null
    );
  }, [conversations, selectedConversationId]);

  const headerTimestamp = currentConversation?.lastMessageAt
    ? formatMessageTimestamp(currentConversation.lastMessageAt)
    : null;

  const isMobileChatOpen =
    mobileView === "chat" && Boolean(selectedConversationId);

  void presenceTick;

  return (
    <main className="min-h-screen bg-[#0b0c0f]">
      <div className="flex h-screen w-full flex-col overflow-hidden bg-[#0f1013] md:flex-row">
        <aside
          className={`bg-gradient-to-b from-[#202225] to-[#1a1b1f] md:flex md:w-[22%] md:min-w-[320px] md:max-w-[380px] md:flex-col md:border-r md:border-neutral-800 ${
            isMobileChatOpen ? "hidden" : "flex flex-1 flex-col"
          }`}
        >
          <div className="flex h-16 items-center justify-between border-b border-neutral-700/80 px-4 md:px-5">
            <div className="flex items-center gap-3">
              <button type="button" className="text-lg text-neutral-300">
                ☰
              </button>
              <h1 className="text-xl font-semibold text-neutral-100">Chats</h1>
            </div>
            <UserButton
              appearance={{ elements: { avatarBox: "size-9" } }}
              afterSignOutUrl="/"
            />
          </div>

          <div className="space-y-3 border-b border-neutral-700/80 px-4 py-4 md:px-5">
            <input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setInviteFeedback(null);
                setInviteError(null);
              }}
              placeholder="Search by email address"
              className="h-10 w-full rounded-xl border border-neutral-600 bg-neutral-800 px-3 text-sm text-neutral-100 outline-none ring-offset-2 placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-700"
            />
            <details className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-3">
              <summary className="cursor-pointer text-sm font-medium text-neutral-200">
                Create group
              </summary>
              <div className="mt-3 space-y-2">
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Group name"
                  className="h-9 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 text-sm text-neutral-100"
                />
                <p className="text-[11px] text-neutral-400">
                  Select at least 2 members to create a group.
                </p>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-neutral-700 p-2">
                  {discoverableUsers.map((person) => {
                    const selected = selectedGroupMembers.includes(person._id);
                    return (
                      <label
                        key={person._id}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                      >
                        <span className="truncate">{person.displayName}</span>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            setSelectedGroupMembers((previous) =>
                              selected
                                ? previous.filter((id) => id !== person._id)
                                : [...previous, person._id],
                            );
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
                <Button
                  className="h-9 w-full bg-neutral-100 text-neutral-900 hover:bg-neutral-300"
                  disabled={
                    isCreatingGroup ||
                    !groupName.trim() ||
                    selectedGroupMembers.length < 2
                  }
                  onClick={async () => {
                    setConversationActionError(null);

                    if (selectedGroupMembers.length < 2) {
                      setConversationActionError(
                        "Select at least 2 members to create a group.",
                      );
                      return;
                    }

                    setIsCreatingGroup(true);

                    try {
                      const conversationId = await createGroupConversation({
                        name: groupName,
                        memberIds: selectedGroupMembers,
                      });
                      setGroupName("");
                      setSelectedGroupMembers([]);
                      setSelectedConversationId(conversationId);
                      setMobileView("chat");
                    } catch {
                      setConversationActionError(
                        "Could not create group. Select members and try again.",
                      );
                    } finally {
                      setIsCreatingGroup(false);
                    }
                  }}
                >
                  {isCreatingGroup ? "Creating..." : "Create group"}
                </Button>
              </div>
            </details>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5">
            {conversationActionError ? (
              <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
                {conversationActionError}
              </div>
            ) : null}

            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
              Start a conversation
            </p>
            <div className="space-y-2">
              {!hasSearch ? (
                <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-900/70 p-4 text-sm text-neutral-400">
                  Enter a friend&apos;s email to find them.
                </div>
              ) : !hasValidSearchEmail ? (
                <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-900/70 p-4 text-sm text-neutral-400">
                  Enter a valid email address to search.
                </div>
              ) : isDiscoverableUsersLoading ? (
                <div className="rounded-xl border border-neutral-700 bg-neutral-900/70 p-4 text-sm text-neutral-400">
                  Searching user...
                </div>
              ) : matchedUser ? (
                <button
                  key={matchedUser._id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border border-neutral-700 bg-neutral-900/70 p-3 text-left transition hover:border-neutral-500 hover:bg-neutral-800"
                  onClick={async () => {
                    setConversationActionError(null);
                    setSendError(null);
                    setFailedMessageDraft(null);

                    try {
                      const conversationId = await openOrCreateConversation({
                        peerUserId: matchedUser._id,
                      });
                      setSelectedConversationId(conversationId);
                      setMobileView("chat");
                    } catch {
                      setConversationActionError(
                        "Could not open conversation. Please try again.",
                      );
                    }
                  }}
                >
                  <div className="relative">
                    <UserAvatar
                      name={matchedUser.displayName}
                      imageUrl={matchedUser.imageUrl}
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 block size-2.5 rounded-full border border-white ${
                        isOnlineNow(
                          matchedUser.lastSeenAt,
                          matchedUser.isOnline,
                        )
                          ? "bg-emerald-500"
                          : "bg-slate-300"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-100">
                      {matchedUser.displayName}
                    </p>
                    <p className="truncate text-xs text-neutral-400">
                      {matchedUser.email ?? normalizedSearchTerm}
                    </p>
                  </div>
                </button>
              ) : (
                <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-900/70 p-4 text-sm text-neutral-400">
                  <p>No registered user found for this email.</p>
                  <div className="mt-3">
                    <Button
                      type="button"
                      className="h-8 px-3 text-xs"
                      disabled={!canSendInvite || isSendingInvite}
                      onClick={async () => {
                        setIsSendingInvite(true);
                        setInviteFeedback(null);
                        setInviteError(null);

                        try {
                          const response = await fetch("/api/invitations", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              email: normalizedSearchTerm,
                              inviterName:
                                user?.fullName ?? user?.username ?? undefined,
                            }),
                          });
                          const payload = (await response.json()) as {
                            error?: string;
                          };

                          if (!response.ok) {
                            setInviteError(
                              payload.error ??
                                "Could not send invite right now. Please try again.",
                            );
                            return;
                          }

                          setInviteFeedback(
                            `Invitation sent to ${normalizedSearchTerm}.`,
                          );
                        } catch {
                          setInviteError(
                            "Could not send invite right now. Please try again.",
                          );
                        } finally {
                          setIsSendingInvite(false);
                        }
                      }}
                    >
                      {isSendingInvite ? "Sending invite..." : "Send invite"}
                    </Button>
                  </div>
                  {inviteFeedback ? (
                    <p className="mt-2 text-xs text-emerald-300">
                      {inviteFeedback}
                    </p>
                  ) : null}
                  {inviteError ? (
                    <p className="mt-2 text-xs text-rose-300">{inviteError}</p>
                  ) : null}
                </div>
              )}
            </div>

            <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
              Existing conversations
            </p>
            <div className="space-y-2">
              {isConversationsLoading ? (
                <div className="rounded-xl border border-neutral-700 bg-neutral-900/70 p-4 text-sm text-neutral-400">
                  Loading conversations...
                </div>
              ) : conversations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-900/70 p-4 text-sm text-neutral-400">
                  No conversations yet. Start chatting with someone above.
                </div>
              ) : (
                conversations.map((conversation) => {
                  const isSelected =
                    conversation._id === selectedConversationId;
                  const online = conversation.otherUser
                    ? isOnlineNow(
                        conversation.otherUser.lastSeenAt,
                        conversation.otherUser.isOnline,
                      )
                    : false;
                  const avatarName =
                    conversation.otherUser?.displayName ?? conversation.title;
                  const avatarImage = conversation.otherUser?.imageUrl;

                  return (
                    <button
                      key={conversation._id}
                      type="button"
                      onClick={() => {
                        setSelectedConversationId(conversation._id);
                        setMobileView("chat");
                        setUnseenIncomingCount(0);
                        setSendError(null);
                        setFailedMessageDraft(null);
                        setConversationActionError(null);
                      }}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? "border-neutral-400 bg-neutral-700/50"
                          : "border-neutral-700 bg-neutral-900/70 hover:border-neutral-500 hover:bg-neutral-800"
                      }`}
                    >
                      <div className="relative">
                        <UserAvatar name={avatarName} imageUrl={avatarImage} />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 block size-2.5 rounded-full border border-neutral-900 ${
                            online ? "bg-emerald-500" : "bg-neutral-500"
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-neutral-100">
                            {conversation.title}
                          </p>
                          <p className="shrink-0 text-[11px] text-neutral-400">
                            {formatMessageTimestamp(
                              conversation.lastMessageAt ??
                                conversation.updatedAt,
                            )}
                          </p>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-neutral-400">
                            {conversation.type === "group"
                              ? `${conversation.memberCount} members`
                              : "Direct message"}
                            {" - "}
                            {conversation.lastMessageText ??
                              "Conversation created"}
                          </p>
                          {conversation.unreadCount > 0 ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 py-0.5 text-[11px] font-medium text-black">
                              {conversation.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        <section
          className={`flex flex-1 flex-col ${
            isMobileChatOpen ? "flex" : "hidden md:flex"
          }`}
        >
          <header className="flex h-16 items-center border-b border-neutral-700/80 bg-gradient-to-b from-[#202225] to-[#1a1b1f] px-4 md:px-6">
            <div className="flex w-full items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileView("list")}
                className="rounded-lg border border-neutral-700 px-2 py-1 text-sm text-neutral-300 md:hidden"
              >
                Back
              </button>
              <div>
                <h2 className="text-base font-semibold text-neutral-100 md:text-lg">
                  {selectedConversationLabel}
                </h2>
                <p className="truncate text-sm text-neutral-400">
                  {selectedConversation
                    ? headerTimestamp
                      ? `Last activity: ${headerTimestamp}`
                      : selectedConversation.type === "group"
                        ? `${selectedConversation.memberCount} members in this group`
                        : "Direct conversation connected in real time."
                    : "Choose a user from the left to open or create a direct conversation."}
                </p>
              </div>
            </div>
          </header>

          {!selectedConversationId ? (
            <div className="flex flex-1 items-center justify-center bg-[#0a0b0d] p-6">
              <div className="text-center">
                <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full border-4 border-dashed border-neutral-300 text-3xl text-neutral-100">
                  💬
                </div>
                <p className="text-3xl font-semibold text-neutral-100">
                  Welcome to Jigsaw
                </p>
                <p className="mt-2 text-base text-neutral-400">
                  Select a conversation from the left to start chatting.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div
                ref={messageScrollRef}
                onScroll={(event) => {
                  const target = event.currentTarget;
                  const distanceFromBottom =
                    target.scrollHeight -
                    target.scrollTop -
                    target.clientHeight;

                  if (distanceFromBottom <= AUTO_SCROLL_THRESHOLD) {
                    setUnseenIncomingCount(0);
                  }
                }}
                className="relative flex-1 space-y-3 overflow-y-auto bg-[#0a0b0d] p-4 md:p-6"
              >
                {isMessagesLoading ? (
                  <div className="mx-auto w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-5 text-center text-sm text-neutral-400">
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="mx-auto w-full max-w-md rounded-2xl border border-dashed border-neutral-700 bg-neutral-900 p-5 text-center text-sm text-neutral-400">
                    No messages yet. Send the first message.
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message._id}
                      className={`flex ${message.isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                          message.isMine
                            ? "bg-[#2f2f34] text-white"
                            : "border border-neutral-700 bg-[#1b1c20] text-neutral-100"
                        }`}
                      >
                        {!message.isMine ? (
                          <p className="mb-1 text-[11px] font-semibold text-neutral-400">
                            {message.senderName}
                          </p>
                        ) : null}
                        <p
                          className={`whitespace-pre-wrap break-words ${
                            message.isDeleted ? "italic opacity-80" : ""
                          }`}
                        >
                          {message.body}
                        </p>
                        <p
                          className={`mt-2 text-[11px] ${
                            message.isMine
                              ? "text-neutral-300"
                              : "text-neutral-400"
                          }`}
                        >
                          {formatMessageTimestamp(message.createdAt)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {REACTION_SET.map((emoji) => {
                            const reactions = message.reactions ?? [];
                            const existing = reactions.find(
                              (reaction) => reaction.emoji === emoji,
                            );
                            const count = existing?.count ?? 0;
                            const reactedByMe = existing?.reactedByMe ?? false;

                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={async () => {
                                  await toggleReaction({
                                    messageId: message._id,
                                    emoji,
                                  });
                                }}
                                className={`rounded-full border px-1.5 py-0.5 text-[11px] ${
                                  reactedByMe
                                    ? "border-neutral-500 bg-neutral-200 text-neutral-900"
                                    : "border-transparent bg-black/20 text-current"
                                }`}
                              >
                                {emoji}
                                {count > 0 ? ` ${count}` : ""}
                              </button>
                            );
                          })}

                          {message.isMine && !message.isDeleted ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await softDeleteMessage({
                                  messageId: message._id,
                                });
                              }}
                              className="rounded-full border border-rose-200 px-1.5 py-0.5 text-[11px] text-rose-600"
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {typingState ? (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-neutral-700 bg-[#1b1c20] px-4 py-2 text-xs text-neutral-300">
                      {typingState.displayName} is typing...
                    </div>
                  </div>
                ) : null}

                {unseenIncomingCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!messageScrollRef.current) {
                        return;
                      }

                      messageScrollRef.current.scrollTop =
                        messageScrollRef.current.scrollHeight;
                      setUnseenIncomingCount(0);
                    }}
                    className="sticky bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow"
                  >
                    ↓ New messages ({unseenIncomingCount})
                  </button>
                ) : null}
              </div>

              <form
                className="border-t border-neutral-800 bg-[#111216] p-3 md:p-4"
                onSubmit={async (event) => {
                  event.preventDefault();

                  if (!selectedConversationId || !draftMessage.trim()) {
                    return;
                  }

                  setIsSending(true);
                  setSendError(null);

                  try {
                    await sendMessage({
                      conversationId: selectedConversationId,
                      body: draftMessage,
                    });

                    void setTyping({
                      conversationId: selectedConversationId,
                      isTyping: false,
                    });

                    setFailedMessageDraft(null);
                    setDraftMessage("");
                    setUnseenIncomingCount(0);
                  } catch {
                    setSendError(
                      "Message failed to send. Check connection and retry.",
                    );
                    setFailedMessageDraft(draftMessage);
                  } finally {
                    setIsSending(false);
                  }
                }}
              >
                {sendError ? (
                  <div className="mb-2 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
                    <div className="flex items-center justify-between gap-2">
                      <span>{sendError}</span>
                      {failedMessageDraft && selectedConversationId ? (
                        <button
                          type="button"
                          className="rounded-md border border-rose-500/40 px-2 py-1 text-[11px] font-medium text-rose-200"
                          onClick={async () => {
                            setIsSending(true);
                            setSendError(null);

                            try {
                              await sendMessage({
                                conversationId: selectedConversationId,
                                body: failedMessageDraft,
                              });

                              setFailedMessageDraft(null);
                              setDraftMessage("");
                            } catch {
                              setSendError(
                                "Retry failed. Please try once more in a moment.",
                              );
                            } finally {
                              setIsSending(false);
                            }
                          }}
                        >
                          Retry
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-end gap-2">
                  <textarea
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    rows={2}
                    placeholder="Type a message"
                    className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none ring-offset-2 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-700"
                  />
                  <Button
                    type="submit"
                    className="h-11 px-5"
                    disabled={isSending || !draftMessage.trim()}
                  >
                    {isSending ? "Sending..." : "Send"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
