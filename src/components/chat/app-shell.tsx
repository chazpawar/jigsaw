"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowRight,
  CheckCircle,
  CopySimple,
  DotsThree,
  Info,
  List,
  MagnifyingGlass,
  Paperclip,
  PaperPlaneTilt,
  PushPin,
  Smiley,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "convex/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { formatMessageTime, formatMessageTimestamp } from "@/lib/time";

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

function formatFileSize(size?: number) {
  if (!size || size <= 0) {
    return "";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function previewText(value: string, limit = 72) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Attachment";
  }

  return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed;
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

type TypingState = {
  displayName: string;
  updatedAt: number;
};

type ForwardPayload = {
  body: string;
  attachmentUrl?: string | null;
  attachmentName?: string;
};

export function AppShell() {
  const { user, isLoaded } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [draftAttachment, setDraftAttachment] = useState<File | null>(null);
  const [selectedConversationId, setSelectedConversationId] =
    useState<Id<"conversations"> | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [, setPresenceTick] = useState(0);
  const [unseenIncomingCount, setUnseenIncomingCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [conversationActionError, setConversationActionError] = useState<
    string | null
  >(null);
  const [failedMessageDraft, setFailedMessageDraft] = useState<string | null>(
    null,
  );
  const [activeReactionMessageId, setActiveReactionMessageId] =
    useState<Id<"messages"> | null>(null);
  const [activeMessageMenuId, setActiveMessageMenuId] =
    useState<Id<"messages"> | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<
    Id<"messages">[]
  >([]);
  const [pinnedMessageId, setPinnedMessageId] = useState<Id<"messages"> | null>(
    null,
  );
  const [replyTarget, setReplyTarget] = useState<{
    messageId: Id<"messages">;
    senderName: string;
    preview: string;
  } | null>(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardPayload, setForwardPayload] = useState<ForwardPayload | null>(
    null,
  );
  const [forwardSearchTerm, setForwardSearchTerm] = useState("");
  const [forwardConversationId, setForwardConversationId] =
    useState<Id<"conversations"> | null>(null);
  const [forwardError, setForwardError] = useState<string | null>(null);
  const [isForwarding, setIsForwarding] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const messageScrollRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const previousMessageCountRef = useRef(0);
  const scrollPositionByConversationRef = useRef<Record<string, number>>({});
  const restoredConversationScrollRef = useRef<string | null>(null);

  const saveConversationScroll = useCallback(
    (conversationId: Id<"conversations">, scrollTop: number) => {
      const key = String(conversationId);
      scrollPositionByConversationRef.current[key] = scrollTop;

      try {
        window.localStorage.setItem(
          `jigsaw:scroll:${conversationId}`,
          String(scrollTop),
        );
      } catch {
        // ignore storage write errors
      }
    },
    [],
  );

  const readConversationScroll = useCallback(
    (conversationId: Id<"conversations">) => {
      const key = String(conversationId);
      const inMemory = scrollPositionByConversationRef.current[key];
      if (typeof inMemory === "number") {
        return inMemory;
      }

      try {
        const stored = window.localStorage.getItem(
          `jigsaw:scroll:${conversationId}`,
        );
        if (stored === null) {
          return null;
        }

        const parsed = Number(stored);
        return Number.isFinite(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    [],
  );

  const scrollToLatestMessage = () => {
    window.requestAnimationFrame(() => {
      if (!messageScrollRef.current) {
        return;
      }

      messageScrollRef.current.scrollTop =
        messageScrollRef.current.scrollHeight;

      if (selectedConversationId) {
        saveConversationScroll(
          selectedConversationId,
          messageScrollRef.current.scrollTop,
        );
      }
    });
  };

  const upsertFromClerk = useMutation(api.users.upsertFromClerk);
  const heartbeat = useMutation(api.users.heartbeat);
  const setOffline = useMutation(api.users.setOffline);
  const openOrCreateConversation = useMutation(
    api.conversations.openOrCreateDirectConversation,
  );
  const sendMessage = useMutation(api.messages.send);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const softDeleteMessage = useMutation(api.messages.softDelete);
  const toggleReaction = useMutation(api.messages.toggleReaction);
  const markConversationRead = useMutation(api.messages.markConversationRead);
  const setTyping = useMutation(api.typing.setTyping);

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

    if (messages.length === 0) {
      return;
    }

    void markConversationRead({ conversationId: selectedConversationId });
  }, [markConversationRead, messages, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    restoredConversationScrollRef.current = null;
    setActiveReactionMessageId(null);
    setActiveMessageMenuId(null);
    setSelectedMessageIds([]);
    setPinnedMessageId(null);
    setReplyTarget(null);
    setIsForwardModalOpen(false);
    setForwardPayload(null);
    setForwardSearchTerm("");
    setForwardConversationId(null);
    setForwardError(null);
  }, [selectedConversationId]);

  useLayoutEffect(() => {
    if (!selectedConversationId || isMessagesLoading) {
      return;
    }

    const conversationKey = String(selectedConversationId);
    if (restoredConversationScrollRef.current === conversationKey) {
      return;
    }

    restoredConversationScrollRef.current = conversationKey;

    const container = messageScrollRef.current;
    if (!container) {
      return;
    }

    const savedScrollTop = readConversationScroll(selectedConversationId);
    if (typeof savedScrollTop === "number") {
      const maxScrollTop = Math.max(
        0,
        container.scrollHeight - container.clientHeight,
      );
      container.scrollTop = Math.min(savedScrollTop, maxScrollTop);
    } else {
      container.scrollTop = container.scrollHeight;
    }

    previousMessageCountRef.current = messages.length;
  }, [
    isMessagesLoading,
    messages.length,
    readConversationScroll,
    selectedConversationId,
  ]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    const conversationKey = String(selectedConversationId);
    if (restoredConversationScrollRef.current !== conversationKey) {
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

  const forwardableConversations = useMemo(() => {
    const term = forwardSearchTerm.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (!term) {
        return true;
      }

      return conversation.title.toLowerCase().includes(term);
    });
  }, [conversations, forwardSearchTerm]);

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

  return (
    <main className="min-h-screen bg-[#0b0c0f]">
      <div className="flex h-screen w-full flex-col overflow-hidden bg-[#0f1013] md:flex-row">
        <aside
          className={`bg-[#16171b] md:flex md:w-[22%] md:min-w-[320px] md:max-w-[380px] md:flex-col md:border-r md:border-neutral-700/40 ${
            isMobileChatOpen ? "hidden" : "flex flex-1 flex-col"
          }`}
        >
          <div className="flex h-16 items-center justify-between px-4 md:px-5">
            <div className="flex items-center gap-3">
              <button type="button" className="text-lg text-neutral-300">
                <List size={18} weight="bold" />
              </button>
              <h1 className="text-xl font-semibold text-neutral-100">Chats</h1>
            </div>
            <UserButton
              appearance={{ elements: { avatarBox: "size-9" } }}
              afterSignOutUrl="/"
            />
          </div>

          <div className="space-y-3 px-4 py-4 md:px-5">
            <input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setInviteFeedback(null);
                setInviteError(null);
              }}
              placeholder="Search by email address"
              className="h-10 w-full rounded-xl bg-[#3a3b40] px-3 text-sm text-neutral-100 outline-none ring-offset-2 placeholder:text-neutral-300 focus:ring-2 focus:ring-neutral-500/70"
            />
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5">
            {conversationActionError ? (
              <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
                {conversationActionError}
              </div>
            ) : null}

            <div className="space-y-2.5">
              {!hasSearch ? null : !hasValidSearchEmail ? (
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
                      disabled={!canSendInvite}
                      onClick={async () => {
                        setInviteFeedback(null);
                        setInviteError(null);

                        try {
                          const inviteLink = `${window.location.origin}/auth/sign-up?email_address=${encodeURIComponent(normalizedSearchTerm)}`;
                          await navigator.clipboard.writeText(inviteLink);
                          setInviteFeedback(
                            `Invite link copied for ${normalizedSearchTerm}.`,
                          );
                        } catch {
                          setInviteError(
                            "Could not copy invite link. Please copy it manually.",
                          );
                        }
                      }}
                    >
                      Copy invite link
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
                      className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${
                        isSelected
                          ? "bg-[#4a4b50]"
                          : "bg-transparent hover:bg-[#3a3b40]"
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
                          <p className="shrink-0 text-[12px] text-neutral-300/85">
                            {formatMessageTimestamp(
                              conversation.lastMessageAt ??
                                conversation.updatedAt,
                            )}
                          </p>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="line-clamp-2 text-sm text-neutral-300/90">
                            {conversation.lastMessageText ??
                              (conversation.type === "group"
                                ? `${conversation.memberCount} members`
                                : "Conversation created")}
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
          className={`flex flex-1 flex-col bg-[#0a0b0d] ${
            isMobileChatOpen ? "flex" : "hidden md:flex"
          }`}
        >
          <header className="relative z-10 flex h-16 items-center bg-[#0a0b0d] px-4 shadow-[0_6px_14px_rgba(0,0,0,0.45)] md:px-6">
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

                  if (selectedConversationId) {
                    saveConversationScroll(
                      selectedConversationId,
                      target.scrollTop,
                    );
                  }

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
                      className={`group flex ${message.isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`relative max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                          message.isMine
                            ? "bg-[#2f2f34] text-white"
                            : "bg-[#1b1c20] text-neutral-100"
                        } ${message.reactions.length > 0 ? "pb-6" : ""} ${
                          selectedMessageIds.includes(message._id)
                            ? "ring-1 ring-neutral-500"
                            : ""
                        }`}
                      >
                        <div
                          className={`absolute top-1/2 z-10 flex -translate-y-1/2 items-center gap-1 rounded-full p-1 opacity-0 transition group-hover:opacity-100 ${
                            message.isMine
                              ? "right-full mr-2"
                              : "left-full ml-2"
                          }`}
                        >
                          <button
                            type="button"
                            aria-label="More options"
                            onClick={() => {
                              setActiveReactionMessageId(null);
                              setActiveMessageMenuId((current) =>
                                current === message._id ? null : message._id,
                              );
                            }}
                            className="flex size-6 items-center justify-center rounded-full text-xs text-neutral-200"
                          >
                            <DotsThree size={16} weight="bold" />
                          </button>
                          <button
                            type="button"
                            aria-label="Reply to message"
                            onClick={() => {
                              setReplyTarget({
                                messageId: message._id,
                                senderName: message.senderName,
                                preview: previewText(
                                  message.body ||
                                    message.attachmentName ||
                                    "Attachment",
                                ),
                              });
                              setActiveMessageMenuId(null);
                            }}
                            className="flex size-6 items-center justify-center rounded-full text-xs text-neutral-200"
                          >
                            <ArrowBendUpLeft size={14} weight="bold" />
                          </button>
                          <button
                            type="button"
                            aria-label="Add reaction"
                            onClick={() => {
                              setActiveMessageMenuId(null);
                              setActiveReactionMessageId((current) =>
                                current === message._id ? null : message._id,
                              );
                            }}
                            className="flex size-6 items-center justify-center rounded-full text-xs text-neutral-200"
                          >
                            <Smiley size={14} weight="duotone" />
                          </button>
                        </div>

                        {activeMessageMenuId === message._id ? (
                          <div
                            className={`absolute top-0 z-30 max-h-[70vh] min-w-40 overflow-y-auto rounded-xl bg-[#3a3a3f] p-2 text-xs shadow-xl ${
                              message.isMine
                                ? "right-full mr-14"
                                : "left-full ml-14"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMessageIds((previous) =>
                                  previous.includes(message._id)
                                    ? previous.filter(
                                        (id) => id !== message._id,
                                      )
                                    : [...previous, message._id],
                                );
                                setActiveMessageMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-neutral-100 hover:bg-white/10"
                            >
                              <CheckCircle size={14} />
                              Select
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const content =
                                  message.body || message.attachmentUrl;
                                if (content) {
                                  await navigator.clipboard.writeText(content);
                                }
                                setActiveMessageMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-neutral-100 hover:bg-white/10"
                            >
                              <CopySimple size={14} />
                              Copy text
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setForwardPayload({
                                  body: message.body,
                                  attachmentUrl: message.attachmentUrl,
                                  attachmentName: message.attachmentName,
                                });
                                setForwardConversationId(null);
                                setForwardSearchTerm("");
                                setForwardError(null);
                                setIsForwardModalOpen(true);
                                setActiveMessageMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-neutral-100 hover:bg-white/10"
                            >
                              <ArrowBendUpRight size={14} />
                              Forward message
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPinnedMessageId(message._id);
                                setActiveMessageMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-neutral-100 hover:bg-white/10"
                            >
                              <PushPin size={14} />
                              Pin
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                window.alert(
                                  `Sent at ${formatMessageTime(message.createdAt)}`,
                                );
                                setActiveMessageMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-neutral-100 hover:bg-white/10"
                            >
                              <Info size={14} />
                              Info
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!message.isMine || message.isDeleted) {
                                  setActiveMessageMenuId(null);
                                  return;
                                }

                                await softDeleteMessage({
                                  messageId: message._id,
                                });
                                setActiveMessageMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-rose-300 hover:bg-rose-500/20"
                            >
                              <Trash size={14} />
                              Delete
                            </button>
                          </div>
                        ) : null}

                        {activeReactionMessageId === message._id ? (
                          <div
                            className={`absolute top-0 z-20 flex items-center gap-1 rounded-full bg-[#0f1013] p-1 ${
                              message.isMine
                                ? "right-full mr-14"
                                : "left-full ml-14"
                            }`}
                          >
                            {REACTION_SET.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={async () => {
                                  await toggleReaction({
                                    messageId: message._id,
                                    emoji,
                                  });
                                  setActiveReactionMessageId(null);
                                }}
                                className="rounded-full px-1.5 py-0.5 text-sm hover:bg-neutral-700"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {message.replyToBody ? (
                          <div
                            className={`mb-2 rounded-lg px-2.5 py-2 ${
                              message.isMine ? "bg-[#1f4fc2]" : "bg-[#123f38]"
                            }`}
                            style={{
                              borderLeft: `3px solid ${
                                message.isMine ? "#7fb3ff" : "#2fd7b3"
                              }`,
                            }}
                          >
                            <p
                              className={`text-xs font-medium ${
                                message.isMine
                                  ? "text-[#b9d5ff]"
                                  : "text-[#6ae9cb]"
                              }`}
                            >
                              {message.replyToSenderName ?? "Message"}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-white/90">
                              {message.replyToBody}
                            </p>
                          </div>
                        ) : null}

                        {!message.isDeleted && message.attachmentUrl ? (
                          message.attachmentMimeType?.startsWith("image/") ? (
                            <a
                              href={message.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mb-2 block"
                            >
                              <img
                                src={message.attachmentUrl}
                                alt={message.attachmentName ?? "Attachment"}
                                className="max-h-64 w-full rounded-xl object-cover"
                              />
                            </a>
                          ) : (
                            <a
                              href={message.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mb-2 flex items-center gap-2 rounded-xl bg-black/25 px-3 py-2 text-xs text-neutral-100"
                            >
                              <span>📎</span>
                              <span className="truncate">
                                {message.attachmentName ?? "Attachment"}
                              </span>
                              <span className="shrink-0 text-neutral-400">
                                {formatFileSize(message.attachmentSize)}
                              </span>
                            </a>
                          )
                        ) : null}

                        {message.body ? (
                          <p
                            className={`whitespace-pre-wrap [overflow-wrap:anywhere] break-all ${
                              message.isDeleted ? "italic opacity-80" : ""
                            }`}
                          >
                            {message.body}
                          </p>
                        ) : null}
                        <p
                          className={`mt-2 text-[11px] ${
                            message.isMine
                              ? "text-neutral-300"
                              : "text-neutral-400"
                          }`}
                        >
                          {pinnedMessageId === message._id ? "Pinned - " : ""}
                          {formatMessageTime(message.createdAt)}
                        </p>
                        {message.reactions.length > 0 ? (
                          <div
                            className={`absolute -bottom-3 flex flex-wrap gap-1 ${
                              message.isMine ? "right-3" : "left-3"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={async () => {
                                const reaction = message.reactions[0];
                                if (!reaction) {
                                  return;
                                }

                                await toggleReaction({
                                  messageId: message._id,
                                  emoji: reaction.emoji,
                                });
                              }}
                              className={`rounded-full border border-black/80 bg-[#2a2a2a] px-2 py-0.5 text-[11px] text-neutral-100 shadow-sm ${
                                message.reactions[0]?.reactedByMe
                                  ? "bg-[#343434]"
                                  : ""
                              }`}
                            >
                              {message.reactions[0]?.emoji}
                              {message.reactions[0] &&
                              message.reactions[0].count > 1
                                ? ` ${message.reactions[0].count}`
                                : ""}
                            </button>
                          </div>
                        ) : null}
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

              {isForwardModalOpen ? (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
                  <div className="w-full max-w-sm rounded-2xl bg-[#2f3035] p-4 shadow-2xl">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-base font-semibold text-neutral-100">
                        Forward To
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setIsForwardModalOpen(false);
                          setForwardPayload(null);
                          setForwardConversationId(null);
                          setForwardError(null);
                        }}
                        className="rounded-full p-1 text-neutral-300 hover:bg-white/10"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <label className="mb-3 flex h-10 items-center gap-2 rounded-lg bg-[#484950] px-3 text-neutral-300">
                      <MagnifyingGlass size={15} />
                      <input
                        value={forwardSearchTerm}
                        onChange={(event) =>
                          setForwardSearchTerm(event.target.value)
                        }
                        placeholder="Name, username, or email"
                        className="h-full w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
                      />
                    </label>

                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {forwardableConversations.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-neutral-400">
                          No conversations found.
                        </p>
                      ) : (
                        forwardableConversations.map((conversation) => (
                          <button
                            key={conversation._id}
                            type="button"
                            onClick={() =>
                              setForwardConversationId(conversation._id)
                            }
                            className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition ${
                              forwardConversationId === conversation._id
                                ? "bg-white/10"
                                : "hover:bg-white/5"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm text-neutral-100">
                                {conversation.title}
                              </p>
                              <p className="truncate text-xs text-neutral-400">
                                {conversation.type === "group"
                                  ? `${conversation.memberCount} members`
                                  : "Direct message"}
                              </p>
                            </div>
                            <span
                              className={`ml-3 size-5 rounded-full border ${
                                forwardConversationId === conversation._id
                                  ? "border-transparent bg-blue-500"
                                  : "border-neutral-500"
                              }`}
                            />
                          </button>
                        ))
                      )}
                    </div>

                    {forwardError ? (
                      <p className="mt-2 text-xs text-rose-300">
                        {forwardError}
                      </p>
                    ) : null}

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        disabled={
                          !forwardConversationId ||
                          !forwardPayload ||
                          isForwarding
                        }
                        onClick={async () => {
                          if (!forwardConversationId || !forwardPayload) {
                            return;
                          }

                          setIsForwarding(true);
                          setForwardError(null);

                          try {
                            const forwardedBody = [
                              "Forwarded message",
                              forwardPayload.body.trim(),
                              forwardPayload.attachmentUrl
                                ? `Attachment: ${forwardPayload.attachmentUrl}`
                                : "",
                            ]
                              .filter(Boolean)
                              .join("\n");

                            await sendMessage({
                              conversationId: forwardConversationId,
                              body: forwardedBody,
                            });

                            setIsForwardModalOpen(false);
                            setForwardPayload(null);
                            setForwardConversationId(null);
                          } catch {
                            setForwardError(
                              "Could not forward message. Please try again.",
                            );
                          } finally {
                            setIsForwarding(false);
                          }
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ArrowRight size={18} weight="bold" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <form
                className="bg-[#0a0b0d] p-3 md:p-4"
                onSubmit={async (event) => {
                  event.preventDefault();

                  if (
                    !selectedConversationId ||
                    (!draftMessage.trim() && !draftAttachment)
                  ) {
                    return;
                  }

                  setIsSending(true);
                  setSendError(null);
                  setActiveMessageMenuId(null);
                  setActiveReactionMessageId(null);

                  try {
                    let attachmentStorageId: Id<"_storage"> | undefined;
                    const composedBody = draftMessage;

                    if (draftAttachment) {
                      const uploadUrl = await generateUploadUrl({});
                      const uploadResult = await fetch(uploadUrl, {
                        method: "POST",
                        headers: {
                          "Content-Type":
                            draftAttachment.type || "application/octet-stream",
                        },
                        body: draftAttachment,
                      });

                      if (!uploadResult.ok) {
                        throw new Error("Upload failed");
                      }

                      const uploadResponse = (await uploadResult.json()) as {
                        storageId: Id<"_storage">;
                      };
                      attachmentStorageId = uploadResponse.storageId;
                    }

                    await sendMessage({
                      conversationId: selectedConversationId,
                      body: composedBody,
                      replyToMessageId: replyTarget?.messageId,
                      replyToSenderName: replyTarget?.senderName,
                      replyToBody: replyTarget?.preview,
                      attachmentStorageId,
                      attachmentName: draftAttachment?.name,
                      attachmentMimeType: draftAttachment?.type,
                      attachmentSize: draftAttachment?.size,
                    });

                    void setTyping({
                      conversationId: selectedConversationId,
                      isTyping: false,
                    });

                    setFailedMessageDraft(null);
                    setDraftMessage("");
                    setDraftAttachment(null);
                    setReplyTarget(null);
                    setUnseenIncomingCount(0);
                    scrollToLatestMessage();
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
                              scrollToLatestMessage();
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

                {replyTarget ? (
                  <div className="mb-2 flex items-start justify-between gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-xs text-neutral-300">
                    <div className="min-w-0 flex-1 border-l-2 border-sky-400 pl-2">
                      <p className="truncate text-[11px] font-semibold text-sky-300">
                        {replyTarget.senderName}
                      </p>
                      <p className="truncate text-xs text-neutral-300">
                        {replyTarget.preview}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-md bg-neutral-800 px-2 py-1 text-[11px] text-neutral-200"
                      onClick={() => setReplyTarget(null)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : null}

                {draftAttachment ? (
                  <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-xs text-neutral-300">
                    <span className="truncate">
                      📎 {draftAttachment.name} (
                      {formatFileSize(draftAttachment.size)})
                    </span>
                    <button
                      type="button"
                      className="rounded-md bg-neutral-800 px-2 py-1 text-[11px] text-neutral-200"
                      onClick={() => setDraftAttachment(null)}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}

                <div className="flex min-w-0 items-center gap-2">
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setDraftAttachment(file);
                      event.currentTarget.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-base text-neutral-200 hover:bg-neutral-800"
                    aria-label="Attach file"
                  >
                    <Paperclip size={18} weight="bold" />
                  </button>
                  <textarea
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" || event.shiftKey) {
                        return;
                      }

                      if (
                        isSending ||
                        (!draftMessage.trim() && !draftAttachment)
                      ) {
                        return;
                      }

                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }}
                    rows={1}
                    placeholder="Message"
                    className="h-11 max-h-32 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto rounded-xl bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 outline-none ring-offset-2 placeholder:text-neutral-500 "
                  />
                  <Button
                    type="submit"
                    className="h-11 shrink-0 self-center px-5"
                    disabled={
                      isSending || (!draftMessage.trim() && !draftAttachment)
                    }
                  >
                    {isSending ? (
                      "Sending..."
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <PaperPlaneTilt size={16} weight="fill" />
                        Send
                      </span>
                    )}
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
