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

function isOnlineNow(lastSeenAt?: number, isOnline?: boolean) {
  if (!isOnline || !lastSeenAt) {
    return false;
  }

  return Date.now() - lastSeenAt < ONLINE_WINDOW_MS;
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
    <div className="flex size-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
      {fallback}
    </div>
  );
}

type DiscoverableUser = {
  _id: Id<"users">;
  displayName: string;
  imageUrl?: string;
  isOnline: boolean;
  lastSeenAt?: number;
};

type SidebarConversation = {
  _id: Id<"conversations">;
  updatedAt: number;
  lastMessageText?: string;
  lastMessageAt?: number;
  unreadCount: number;
  otherUser: DiscoverableUser;
};

type ConversationOverview = {
  conversationId: Id<"conversations">;
  otherUser: DiscoverableUser;
};

type Message = {
  _id: Id<"messages">;
  body: string;
  createdAt: number;
  isMine: boolean;
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

  const searchInputRef = useRef<HTMLInputElement>(null);
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
  const markConversationRead = useMutation(api.messages.markConversationRead);
  const setTyping = useMutation(api.typing.setTyping);

  const discoverableUsers = (useQuery(api.users.searchUsers, { searchTerm }) ??
    []) as DiscoverableUser[];
  const conversations = (useQuery(api.conversations.listForCurrentUser) ??
    []) as SidebarConversation[];
  const selectedConversation = useQuery(
    api.conversations.getConversationOverview,
    selectedConversationId
      ? { conversationId: selectedConversationId }
      : "skip",
  ) as ConversationOverview | null | undefined;
  const messages = (useQuery(
    api.messages.listForConversation,
    selectedConversationId
      ? { conversationId: selectedConversationId }
      : "skip",
  ) ?? []) as Message[];
  const typingState = useQuery(
    api.typing.getForConversation,
    selectedConversationId
      ? { conversationId: selectedConversationId }
      : "skip",
  ) as TypingState | null | undefined;

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

  const hasSearch = searchTerm.trim().length > 0;
  const selectedConversationLabel =
    selectedConversation?.otherUser.displayName ?? "Select a conversation";

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
    <main className="min-h-screen bg-slate-100 p-0 md:p-6">
      <div className="mx-auto flex h-screen w-full max-w-6xl flex-col overflow-hidden border border-slate-200 bg-white shadow-xl shadow-slate-200/70 md:h-[calc(100vh-3rem)] md:flex-row md:rounded-2xl">
        <aside
          className={`bg-slate-50 md:flex md:w-96 md:flex-col md:border-r md:border-slate-200 ${
            isMobileChatOpen ? "hidden" : "flex flex-1 flex-col"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 md:px-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Jigsaw Chat
              </p>
              <h1 className="text-lg font-semibold text-slate-900">
                Conversations
              </h1>
            </div>
            <UserButton
              appearance={{ elements: { avatarBox: "size-9" } }}
              afterSignOutUrl="/"
            />
          </div>

          <div className="space-y-3 border-b border-slate-200 px-4 py-4 md:px-5">
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => searchInputRef.current?.focus()}
            >
              New conversation
            </Button>
            <input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search people by name"
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-offset-2 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Start a conversation
            </p>
            <div className="space-y-2">
              {discoverableUsers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                  {hasSearch ? "No users found." : "No users available yet."}
                </div>
              ) : (
                discoverableUsers.map((person) => {
                  const online = isOnlineNow(
                    person.lastSeenAt,
                    person.isOnline,
                  );

                  return (
                    <button
                      key={person._id}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:bg-slate-100"
                      onClick={async () => {
                        const conversationId = await openOrCreateConversation({
                          peerUserId: person._id,
                        });
                        setSelectedConversationId(conversationId);
                        setMobileView("chat");
                      }}
                    >
                      <div className="relative">
                        <UserAvatar
                          name={person.displayName}
                          imageUrl={person.imageUrl}
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 block size-2.5 rounded-full border border-white ${
                            online ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {person.displayName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {online ? "Online" : "Offline"}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Existing conversations
            </p>
            <div className="space-y-2">
              {conversations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                  No conversations yet. Start chatting with someone above.
                </div>
              ) : (
                conversations.map((conversation) => {
                  const isSelected =
                    conversation._id === selectedConversationId;
                  const online = isOnlineNow(
                    conversation.otherUser.lastSeenAt,
                    conversation.otherUser.isOnline,
                  );

                  return (
                    <button
                      key={conversation._id}
                      type="button"
                      onClick={() => {
                        setSelectedConversationId(conversation._id);
                        setMobileView("chat");
                        setUnseenIncomingCount(0);
                      }}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? "border-slate-400 bg-slate-100"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <div className="relative">
                        <UserAvatar
                          name={conversation.otherUser.displayName}
                          imageUrl={conversation.otherUser.imageUrl}
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 block size-2.5 rounded-full border border-white ${
                            online ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {conversation.otherUser.displayName}
                          </p>
                          <p className="shrink-0 text-[11px] text-slate-500">
                            {formatMessageTimestamp(
                              conversation.lastMessageAt ??
                                conversation.updatedAt,
                            )}
                          </p>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-slate-500">
                            {conversation.lastMessageText ??
                              "Conversation created"}
                          </p>
                          {conversation.unreadCount > 0 ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 py-0.5 text-[11px] font-medium text-white">
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
          <header className="border-b border-slate-200 px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileView("list")}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-600 md:hidden"
              >
                Back
              </button>
              <div>
                <h2 className="text-base font-semibold text-slate-900 md:text-lg">
                  {selectedConversationLabel}
                </h2>
                <p className="text-sm text-slate-500">
                  {selectedConversation
                    ? headerTimestamp
                      ? `Last activity: ${headerTimestamp}`
                      : "Direct conversation connected in real time."
                    : "Choose a user from the left to open or create a direct conversation."}
                </p>
              </div>
            </div>
          </header>

          {!selectedConversationId ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No active conversation
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Pick a teammate to initialize your first direct thread.
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
                className="relative flex-1 space-y-3 overflow-y-auto p-4 md:p-6"
              >
                {messages.length === 0 ? (
                  <div className="mx-auto w-full max-w-md rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
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
                            ? "bg-slate-900 text-white"
                            : "border border-slate-200 bg-white text-slate-900"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {message.body}
                        </p>
                        <p
                          className={`mt-2 text-[11px] ${
                            message.isMine ? "text-slate-300" : "text-slate-500"
                          }`}
                        >
                          {formatMessageTimestamp(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}

                {typingState ? (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
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
                className="border-t border-slate-200 p-3 md:p-4"
                onSubmit={async (event) => {
                  event.preventDefault();

                  if (!selectedConversationId || !draftMessage.trim()) {
                    return;
                  }

                  await sendMessage({
                    conversationId: selectedConversationId,
                    body: draftMessage,
                  });

                  void setTyping({
                    conversationId: selectedConversationId,
                    isTyping: false,
                  });

                  setDraftMessage("");
                  setUnseenIncomingCount(0);
                }}
              >
                <div className="flex items-end gap-2">
                  <textarea
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    rows={2}
                    placeholder="Type a message"
                    className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-offset-2 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                  <Button type="submit" className="h-11 px-5">
                    Send
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
