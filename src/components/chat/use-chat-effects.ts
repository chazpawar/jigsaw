import type { Id } from "@convex/_generated/dataModel";
import type { MutableRefObject } from "react";
import { useEffect, useLayoutEffect } from "react";
import type { Message, TypingState } from "./model";

export function usePresenceSync({
  isLoaded,
  user,
  upsertFromClerk,
  heartbeat,
  setOffline,
  onTick,
}: {
  isLoaded: boolean;
  user:
    | {
        fullName?: string | null;
        username?: string | null;
        imageUrl: string;
        primaryEmailAddress?: { emailAddress: string } | null;
      }
    | null
    | undefined;
  upsertFromClerk: (args: {
    displayName: string;
    imageUrl?: string;
    email?: string;
  }) => Promise<unknown>;
  heartbeat: (args: Record<string, never>) => Promise<unknown>;
  setOffline: (args: Record<string, never>) => Promise<unknown>;
  onTick: () => void;
}) {
  useEffect(() => {
    const interval = window.setInterval(() => {
      onTick();
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [onTick]);

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
}

export function useConversationReadSync({
  selectedConversationId,
  messages,
  markConversationRead,
  lastReadMarkerRef,
}: {
  selectedConversationId: Id<"conversations"> | null;
  messages: Message[];
  markConversationRead: (args: {
    conversationId: Id<"conversations">;
  }) => Promise<unknown>;
  lastReadMarkerRef: MutableRefObject<string | null>;
}) {
  useEffect(() => {
    if (!selectedConversationId || messages.length === 0) {
      return;
    }

    const latestMessage = messages[messages.length - 1];
    const marker = `${selectedConversationId}:${latestMessage?._id}`;
    if (lastReadMarkerRef.current === marker) {
      return;
    }
    lastReadMarkerRef.current = marker;

    void markConversationRead({ conversationId: selectedConversationId });
  }, [
    markConversationRead,
    messages,
    selectedConversationId,
    lastReadMarkerRef,
  ]);
}

export function useTypingSync({
  selectedConversationId,
  draftMessage,
  setTyping,
  typingTimeoutRef,
  typingActiveRef,
}: {
  selectedConversationId: Id<"conversations"> | null;
  draftMessage: string;
  setTyping: (args: {
    conversationId: Id<"conversations">;
    isTyping: boolean;
  }) => Promise<unknown>;
  typingTimeoutRef: MutableRefObject<number | null>;
  typingActiveRef: MutableRefObject<boolean>;
}) {
  useEffect(() => {
    if (!selectedConversationId) {
      typingActiveRef.current = false;
      return;
    }

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (!draftMessage.trim()) {
      if (typingActiveRef.current) {
        typingActiveRef.current = false;
        void setTyping({
          conversationId: selectedConversationId,
          isTyping: false,
        });
      }
      return;
    }

    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      void setTyping({
        conversationId: selectedConversationId,
        isTyping: true,
      });
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      typingActiveRef.current = false;
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
  }, [
    draftMessage,
    selectedConversationId,
    setTyping,
    typingActiveRef,
    typingTimeoutRef,
  ]);
}

export function useTypingStateRefresh({
  typingState,
  onTick,
}: {
  typingState: TypingState | null;
  onTick: () => void;
}) {
  useEffect(() => {
    if (!typingState) {
      return;
    }

    const timeout = window.setTimeout(() => {
      onTick();
    }, 2_000);

    return () => window.clearTimeout(timeout);
  }, [typingState, onTick]);
}

export function useScrollRestoreAndIncoming({
  selectedConversationId,
  isMessagesLoading,
  messages,
  messageScrollRef,
  readConversationScroll,
  restoredConversationScrollRef,
  previousMessageCountRef,
  onResetUnseen,
  onIncrementUnseen,
}: {
  selectedConversationId: Id<"conversations"> | null;
  isMessagesLoading: boolean;
  messages: Message[];
  messageScrollRef: MutableRefObject<HTMLDivElement | null>;
  readConversationScroll: (
    conversationId: Id<"conversations">,
  ) => number | null;
  restoredConversationScrollRef: MutableRefObject<string | null>;
  previousMessageCountRef: MutableRefObject<number>;
  onResetUnseen: () => void;
  onIncrementUnseen: (amount: number) => void;
}) {
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
    messageScrollRef,
    messages.length,
    previousMessageCountRef,
    readConversationScroll,
    restoredConversationScrollRef,
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
    const atBottom = distanceFromBottom <= 48;

    if (!hasIncoming || atBottom) {
      container.scrollTop = container.scrollHeight;
      onResetUnseen();
      return;
    }

    onIncrementUnseen(current - previous);
  }, [
    messageScrollRef,
    messages,
    onIncrementUnseen,
    onResetUnseen,
    previousMessageCountRef,
    restoredConversationScrollRef,
    selectedConversationId,
  ]);
}
