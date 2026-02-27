import type { Id } from "@convex/_generated/dataModel";
import { useCallback, useRef } from "react";

export function useChatScroll(
  selectedConversationId: Id<"conversations"> | null,
) {
  const messageScrollRef = useRef<HTMLDivElement>(null);
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

  return {
    messageScrollRef,
    previousMessageCountRef,
    restoredConversationScrollRef,
    saveConversationScroll,
    readConversationScroll,
    scrollToLatestMessage,
  };
}
