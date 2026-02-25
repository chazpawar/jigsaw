"use client";

import { useUser } from "@clerk/nextjs";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { formatMessageTime, formatMessageTimestamp } from "@/lib/time";
import { ChatComposer } from "./chat-composer";
import { ChatForwardModal } from "./chat-forward-modal";
import { ChatMessageList } from "./chat-message-list";
import { ChatSidebar } from "./chat-sidebar";
import {
  AUTO_SCROLL_THRESHOLD,
  formatFileSize,
  isValidEmailAddress,
  previewText,
} from "./chat-utils";
import { Sidebar } from "./layout-sections";
import type {
  ConversationOverview,
  DiscoverableUser,
  Message,
  SidebarConversation,
  TypingState,
} from "./model";
import { chatUiReducer, initialChatUiState } from "./ui-state";
import {
  useConversationReadSync,
  usePresenceSync,
  useScrollRestoreAndIncoming,
  useTypingStateRefresh,
  useTypingSync,
} from "./use-chat-effects";

export function AppShell() {
  const { user, isLoaded } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [draftAttachment, setDraftAttachment] = useState<File | null>(null);
  const [selectedConversationId, setSelectedConversationId] =
    useState<Id<"conversations"> | null>(null);
  const [ui, dispatchUi] = useReducer(chatUiReducer, initialChatUiState);
  const {
    mobileView,
    sidebarCollapsed,
    unseenIncomingCount,
    isSending,
    sendError,
    conversationActionError,
    failedMessageDraft,
    activeReactionMessageId,
    activeMessageMenuId,
    selectedMessageIds,
    pinnedMessageId,
    replyTarget,
    isForwardModalOpen,
    forwardPayload,
    forwardSearchTerm,
    forwardConversationId,
    forwardError,
    isForwarding,
    inviteFeedback,
    inviteError,
  } = ui;

  const [, setPresenceTick] = useState(0);

  const messageScrollRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const typingActiveRef = useRef(false);
  const lastReadMarkerRef = useRef<string | null>(null);
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

  const scrollToLatestMessage = useCallback(() => {
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
  }, [saveConversationScroll, selectedConversationId]);

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
  const typingState = typingStateResult ?? null;

  const isDiscoverableUsersLoading = discoverableUsersResult === undefined;
  const isConversationsLoading = conversationsResult === undefined;
  const isMessagesLoading =
    Boolean(selectedConversationId) && messagesResult === undefined;

  usePresenceSync({
    isLoaded,
    user,
    upsertFromClerk,
    heartbeat,
    setOffline,
    onTick: () => setPresenceTick((value) => value + 1),
  });

  useEffect(() => {
    if (selectedConversationId || conversations.length === 0) {
      return;
    }

    dispatchUi({
      type: "patch",
      payload: { sendError: null, failedMessageDraft: null },
    });
    setSelectedConversationId(conversations[0]?._id ?? null);
  }, [conversations, selectedConversationId]);

  useConversationReadSync({
    selectedConversationId,
    messages,
    markConversationRead,
    lastReadMarkerRef,
  });

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    restoredConversationScrollRef.current = null;
    dispatchUi({ type: "resetConversationUi" });
  }, [selectedConversationId]);

  const resetUnseenIncoming = useCallback(() => {
    dispatchUi({ type: "patch", payload: { unseenIncomingCount: 0 } });
  }, []);

  const incrementUnseenIncoming = useCallback((amount: number) => {
    dispatchUi({ type: "incrementUnseen", by: amount });
  }, []);

  const bumpPresenceTick = useCallback(() => {
    setPresenceTick((value) => value + 1);
  }, []);

  useScrollRestoreAndIncoming({
    selectedConversationId,
    isMessagesLoading,
    messages,
    messageScrollRef,
    readConversationScroll,
    restoredConversationScrollRef,
    previousMessageCountRef,
    onResetUnseen: resetUnseenIncoming,
    onIncrementUnseen: incrementUnseenIncoming,
  });

  useTypingSync({
    selectedConversationId,
    draftMessage,
    setTyping,
    typingTimeoutRef,
    typingActiveRef,
  });

  useTypingStateRefresh({
    typingState,
    onTick: bumpPresenceTick,
  });

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

  const sendCurrentDraft = useCallback(async () => {
    if (!selectedConversationId || (!draftMessage.trim() && !draftAttachment)) {
      return;
    }

    dispatchUi({
      type: "patch",
      payload: {
        isSending: true,
        sendError: null,
        activeMessageMenuId: null,
        activeReactionMessageId: null,
      },
    });

    try {
      let attachmentStorageId: Id<"_storage"> | undefined;

      if (draftAttachment) {
        const uploadUrl = await generateUploadUrl({});
        const uploadResult = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": draftAttachment.type || "application/octet-stream",
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
        body: draftMessage,
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

      dispatchUi({
        type: "patch",
        payload: { failedMessageDraft: null, unseenIncomingCount: 0 },
      });
      setDraftMessage("");
      setDraftAttachment(null);
      dispatchUi({ type: "patch", payload: { replyTarget: null } });
      scrollToLatestMessage();
    } catch {
      dispatchUi({
        type: "patch",
        payload: {
          sendError: "Message failed to send. Check connection and retry.",
          failedMessageDraft: draftMessage,
        },
      });
    } finally {
      dispatchUi({ type: "patch", payload: { isSending: false } });
    }
  }, [
    draftAttachment,
    draftMessage,
    generateUploadUrl,
    replyTarget,
    scrollToLatestMessage,
    selectedConversationId,
    sendMessage,
    setTyping,
  ]);

  const onOpenConversation = useCallback(
    async (peerUserId: Id<"users">) => {
      dispatchUi({
        type: "patch",
        payload: {
          conversationActionError: null,
          sendError: null,
          failedMessageDraft: null,
        },
      });

      try {
        const conversationId = await openOrCreateConversation({ peerUserId });
        setSelectedConversationId(conversationId);
        dispatchUi({ type: "patch", payload: { mobileView: "chat" } });
      } catch {
        dispatchUi({
          type: "patch",
          payload: {
            conversationActionError:
              "Could not open conversation. Please try again.",
          },
        });
      }
    },
    [openOrCreateConversation],
  );

  const onCopyInvite = useCallback(async () => {
    dispatchUi({
      type: "patch",
      payload: { inviteFeedback: null, inviteError: null },
    });

    try {
      const inviteLink = `${window.location.origin}/auth/sign-up?email_address=${encodeURIComponent(normalizedSearchTerm)}`;
      await navigator.clipboard.writeText(inviteLink);
      dispatchUi({
        type: "patch",
        payload: {
          inviteFeedback: `Invite link copied for ${normalizedSearchTerm}.`,
        },
      });
    } catch {
      dispatchUi({
        type: "patch",
        payload: {
          inviteError: "Could not copy invite link. Please copy it manually.",
        },
      });
    }
  }, [normalizedSearchTerm]);

  const onSelectConversation = useCallback(
    (conversationId: Id<"conversations">) => {
      setSelectedConversationId(conversationId);
      dispatchUi({
        type: "patch",
        payload: {
          mobileView: "chat",
          unseenIncomingCount: 0,
          sendError: null,
          failedMessageDraft: null,
          conversationActionError: null,
        },
      });
    },
    [],
  );

  const onMessageListScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;

      if (selectedConversationId) {
        saveConversationScroll(selectedConversationId, target.scrollTop);
      }

      const distanceFromBottom =
        target.scrollHeight - target.scrollTop - target.clientHeight;

      if (distanceFromBottom <= AUTO_SCROLL_THRESHOLD) {
        dispatchUi({ type: "patch", payload: { unseenIncomingCount: 0 } });
      }
    },
    [saveConversationScroll, selectedConversationId],
  );

  const onForwardConfirm = useCallback(async () => {
    if (!forwardConversationId || !forwardPayload) {
      return;
    }

    dispatchUi({
      type: "patch",
      payload: { isForwarding: true, forwardError: null },
    });

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

      dispatchUi({
        type: "patch",
        payload: {
          isForwardModalOpen: false,
          forwardPayload: null,
          forwardConversationId: null,
        },
      });
    } catch {
      dispatchUi({
        type: "patch",
        payload: {
          forwardError: "Could not forward message. Please try again.",
        },
      });
    } finally {
      dispatchUi({ type: "patch", payload: { isForwarding: false } });
    }
  }, [forwardConversationId, forwardPayload, sendMessage]);

  const onRetrySend = useCallback(async () => {
    if (!failedMessageDraft || !selectedConversationId) {
      return;
    }

    dispatchUi({
      type: "patch",
      payload: { isSending: true, sendError: null },
    });

    try {
      await sendMessage({
        conversationId: selectedConversationId,
        body: failedMessageDraft,
      });
      dispatchUi({ type: "patch", payload: { failedMessageDraft: null } });
      setDraftMessage("");
      scrollToLatestMessage();
    } catch {
      dispatchUi({
        type: "patch",
        payload: {
          sendError: "Retry failed. Please try once more in a moment.",
        },
      });
    } finally {
      dispatchUi({ type: "patch", payload: { isSending: false } });
    }
  }, [
    failedMessageDraft,
    scrollToLatestMessage,
    selectedConversationId,
    sendMessage,
  ]);

  return (
    <main className="min-h-screen bg-[#0b0c0f]">
      <div className="flex h-screen w-full flex-col overflow-hidden bg-[#0f1013] md:flex-row">
        <Sidebar
          isMobileChatOpen={isMobileChatOpen}
          isCollapsed={sidebarCollapsed}
        >
          <ChatSidebar
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => {
              dispatchUi({
                type: "patch",
                payload: { sidebarCollapsed: !sidebarCollapsed },
              });
            }}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            clearInviteMessages={() => {
              dispatchUi({
                type: "patch",
                payload: { inviteFeedback: null, inviteError: null },
              });
            }}
            conversationActionError={conversationActionError}
            hasSearch={hasSearch}
            hasValidSearchEmail={hasValidSearchEmail}
            isDiscoverableUsersLoading={isDiscoverableUsersLoading}
            matchedUser={matchedUser}
            normalizedSearchTerm={normalizedSearchTerm}
            canSendInvite={canSendInvite}
            onOpenConversation={onOpenConversation}
            onCopyInvite={onCopyInvite}
            inviteFeedback={inviteFeedback}
            inviteError={inviteError}
            isConversationsLoading={isConversationsLoading}
            conversations={conversations}
            selectedConversationId={selectedConversationId}
            onSelectConversation={onSelectConversation}
          />
        </Sidebar>

        <section
          className={`flex flex-1 flex-col bg-[#0a0b0d] ${
            isMobileChatOpen ? "flex" : "hidden md:flex"
          }`}
        >
          <header className="relative z-10 flex h-16 items-center bg-[#0a0b0d] px-4 shadow-[0_6px_14px_rgba(0,0,0,0.45)] md:px-6">
            <div className="flex w-full items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  dispatchUi({ type: "patch", payload: { mobileView: "list" } })
                }
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
              <ChatMessageList
                messageScrollRef={messageScrollRef}
                onScroll={onMessageListScroll}
                isMessagesLoading={isMessagesLoading}
                messages={messages}
                selectedMessageIds={selectedMessageIds}
                activeMessageMenuId={activeMessageMenuId}
                activeReactionMessageId={activeReactionMessageId}
                pinnedMessageId={pinnedMessageId}
                typingState={typingState}
                unseenIncomingCount={unseenIncomingCount}
                onToggleMenu={(messageId) => {
                  dispatchUi({
                    type: "patch",
                    payload: { activeReactionMessageId: null },
                  });
                  dispatchUi({
                    type: "patch",
                    payload: {
                      activeMessageMenuId:
                        activeMessageMenuId === messageId ? null : messageId,
                    },
                  });
                }}
                onSetReply={(message) => {
                  dispatchUi({
                    type: "patch",
                    payload: {
                      replyTarget: {
                        messageId: message._id,
                        senderName: message.senderName,
                        preview: previewText(
                          message.body ||
                            message.attachmentName ||
                            "Attachment",
                        ),
                      },
                      activeMessageMenuId: null,
                    },
                  });
                }}
                onToggleReactionPicker={(messageId) => {
                  dispatchUi({
                    type: "patch",
                    payload: { activeMessageMenuId: null },
                  });
                  dispatchUi({
                    type: "patch",
                    payload: {
                      activeReactionMessageId:
                        activeReactionMessageId === messageId
                          ? null
                          : messageId,
                    },
                  });
                }}
                onSelectMessage={(messageId) => {
                  dispatchUi({ type: "toggleSelectedMessage", messageId });
                  dispatchUi({
                    type: "patch",
                    payload: { activeMessageMenuId: null },
                  });
                }}
                onCopyText={async (message) => {
                  const content = message.body || message.attachmentUrl;
                  if (content) {
                    await navigator.clipboard.writeText(content);
                  }
                  dispatchUi({
                    type: "patch",
                    payload: { activeMessageMenuId: null },
                  });
                }}
                onForwardMessage={(message) => {
                  dispatchUi({
                    type: "patch",
                    payload: {
                      forwardPayload: {
                        body: message.body,
                        attachmentUrl: message.attachmentUrl,
                        attachmentName: message.attachmentName,
                      },
                      forwardConversationId: null,
                      forwardSearchTerm: "",
                      forwardError: null,
                      isForwardModalOpen: true,
                      activeMessageMenuId: null,
                    },
                  });
                }}
                onPinMessage={(messageId) => {
                  dispatchUi({
                    type: "patch",
                    payload: {
                      pinnedMessageId: messageId,
                      activeMessageMenuId: null,
                    },
                  });
                }}
                onInfoMessage={(createdAt) => {
                  window.alert(`Sent at ${formatMessageTime(createdAt)}`);
                  dispatchUi({
                    type: "patch",
                    payload: { activeMessageMenuId: null },
                  });
                }}
                onDeleteMessage={async (message) => {
                  if (!message.isMine || message.isDeleted) {
                    dispatchUi({
                      type: "patch",
                      payload: { activeMessageMenuId: null },
                    });
                    return;
                  }
                  await softDeleteMessage({ messageId: message._id });
                  dispatchUi({
                    type: "patch",
                    payload: { activeMessageMenuId: null },
                  });
                }}
                onPickReaction={async (messageId, emoji) => {
                  await toggleReaction({ messageId, emoji });
                  dispatchUi({
                    type: "patch",
                    payload: { activeReactionMessageId: null },
                  });
                }}
                onToggleCurrentReaction={async (message) => {
                  const reaction = message.reactions[0];
                  if (!reaction) {
                    return;
                  }
                  await toggleReaction({
                    messageId: message._id,
                    emoji: reaction.emoji,
                  });
                }}
                onJumpToLatest={() => {
                  if (!messageScrollRef.current) {
                    return;
                  }
                  messageScrollRef.current.scrollTop =
                    messageScrollRef.current.scrollHeight;
                  dispatchUi({
                    type: "patch",
                    payload: { unseenIncomingCount: 0 },
                  });
                }}
                formatFileSize={formatFileSize}
              />

              <ChatForwardModal
                isOpen={isForwardModalOpen}
                close={() => {
                  dispatchUi({
                    type: "patch",
                    payload: {
                      isForwardModalOpen: false,
                      forwardPayload: null,
                      forwardConversationId: null,
                      forwardError: null,
                    },
                  });
                }}
                searchTerm={forwardSearchTerm}
                setSearchTerm={(value) => {
                  dispatchUi({
                    type: "patch",
                    payload: { forwardSearchTerm: value },
                  });
                }}
                conversations={forwardableConversations}
                selectedConversationId={forwardConversationId}
                setSelectedConversationId={(value) => {
                  dispatchUi({
                    type: "patch",
                    payload: { forwardConversationId: value },
                  });
                }}
                payload={forwardPayload}
                error={forwardError}
                isForwarding={isForwarding}
                onForward={onForwardConfirm}
              />

              <ChatComposer
                sendError={sendError}
                failedMessageDraft={failedMessageDraft}
                selectedConversationIdPresent={Boolean(selectedConversationId)}
                onRetry={onRetrySend}
                replyTarget={replyTarget}
                clearReplyTarget={() => {
                  dispatchUi({ type: "patch", payload: { replyTarget: null } });
                }}
                draftAttachment={draftAttachment}
                clearAttachment={() => setDraftAttachment(null)}
                formatFileSize={formatFileSize}
                attachmentInputRef={attachmentInputRef}
                onAttachmentChange={setDraftAttachment}
                draftMessage={draftMessage}
                setDraftMessage={setDraftMessage}
                isSending={isSending}
                canSend={Boolean(
                  !isSending && (draftMessage.trim() || draftAttachment),
                )}
                sendCurrentDraft={sendCurrentDraft}
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
