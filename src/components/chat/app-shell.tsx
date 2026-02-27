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
import { formatMessageTimestamp } from "@/lib/time";
import { ChatConversationPane } from "./chat-conversation-pane";
import { ChatSidebar } from "./chat-sidebar";
import { formatFileSize, isValidEmailAddress } from "./chat-utils";
import { Sidebar } from "./layout-sections";
import type {
  ConversationOverview,
  DiscoverableUser,
  Message,
  SidebarConversation,
  TypingState,
} from "./model";
import { chatUiReducer, initialChatUiState } from "./ui-state";
import { useChatActions } from "./use-chat-actions";
import {
  useConversationReadSync,
  usePresenceSync,
  useScrollRestoreAndIncoming,
  useTypingStateRefresh,
  useTypingSync,
} from "./use-chat-effects";
import { useChatScroll } from "./use-chat-scroll";

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
    conversationActionError,
    failedMessageDraft,
    replyTarget,
    forwardPayload,
    forwardSearchTerm,
    forwardConversationId,
    inviteFeedback,
    inviteError,
  } = ui;

  const [, bumpPresenceTick] = useReducer((value: number) => value + 1, 0);

  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const typingActiveRef = useRef(false);
  const lastReadMarkerRef = useRef<string | null>(null);
  const {
    messageScrollRef,
    previousMessageCountRef,
    restoredConversationScrollRef,
    saveConversationScroll,
    readConversationScroll,
    scrollToLatestMessage,
  } = useChatScroll(selectedConversationId);

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
    onTick: bumpPresenceTick,
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
  }, [restoredConversationScrollRef, selectedConversationId]);

  const resetUnseenIncoming = useCallback(() => {
    dispatchUi({ type: "patch", payload: { unseenIncomingCount: 0 } });
  }, []);

  const incrementUnseenIncoming = useCallback((amount: number) => {
    dispatchUi({ type: "incrementUnseen", by: amount });
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

  useTypingStateRefresh({ typingState, onTick: bumpPresenceTick });

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

  const {
    sendCurrentDraft,
    onOpenConversation,
    onCopyInvite,
    onSelectConversation,
    onMessageListScroll,
    onForwardConfirm,
    onRetrySend,
  } = useChatActions({
    selectedConversationId,
    setSelectedConversationId,
    draftMessage,
    setDraftMessage,
    draftAttachment,
    setDraftAttachment,
    replyTarget,
    failedMessageDraft,
    forwardConversationId,
    forwardPayload,
    normalizedSearchTerm,
    scrollToLatestMessage,
    saveConversationScroll,
    openOrCreateConversation,
    sendMessage,
    generateUploadUrl,
    setTyping,
    dispatchUi,
  });

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

        <ChatConversationPane
          isMobileChatOpen={isMobileChatOpen}
          selectedConversationId={selectedConversationId}
          selectedConversationLabel={selectedConversationLabel}
          selectedConversation={selectedConversation}
          headerTimestamp={headerTimestamp}
          messageScrollRef={messageScrollRef}
          onMessageListScroll={onMessageListScroll}
          isMessagesLoading={isMessagesLoading}
          messages={messages}
          typingState={typingState}
          ui={ui}
          dispatchUi={dispatchUi}
          forwardableConversations={forwardableConversations}
          onForwardConfirm={onForwardConfirm}
          onRetrySend={onRetrySend}
          sendCurrentDraft={sendCurrentDraft}
          draftAttachment={draftAttachment}
          setDraftAttachment={setDraftAttachment}
          attachmentInputRef={attachmentInputRef}
          draftMessage={draftMessage}
          setDraftMessage={setDraftMessage}
          formatFileSize={formatFileSize}
          softDeleteMessage={softDeleteMessage}
          toggleReaction={toggleReaction}
        />
      </div>
    </main>
  );
}
