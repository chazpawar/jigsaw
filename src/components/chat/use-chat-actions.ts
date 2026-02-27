import type { Id } from "@convex/_generated/dataModel";
import { type UIEvent, useCallback } from "react";
import { AUTO_SCROLL_THRESHOLD } from "./chat-utils";
import type { ForwardPayload, ReplyTarget } from "./model";
import type { ChatUiDispatch } from "./ui-state";

type Params = {
  selectedConversationId: Id<"conversations"> | null;
  setSelectedConversationId: (value: Id<"conversations"> | null) => void;
  draftMessage: string;
  setDraftMessage: (value: string) => void;
  draftAttachment: File | null;
  setDraftAttachment: (value: File | null) => void;
  replyTarget: ReplyTarget | null;
  failedMessageDraft: string | null;
  forwardConversationId: Id<"conversations"> | null;
  forwardPayload: ForwardPayload | null;
  normalizedSearchTerm: string;
  scrollToLatestMessage: () => void;
  saveConversationScroll: (
    conversationId: Id<"conversations">,
    scrollTop: number,
  ) => void;
  openOrCreateConversation: (args: {
    peerUserId: Id<"users">;
  }) => Promise<Id<"conversations">>;
  sendMessage: (args: {
    conversationId: Id<"conversations">;
    body: string;
    replyToMessageId?: Id<"messages">;
    replyToSenderName?: string;
    replyToBody?: string;
    attachmentStorageId?: Id<"_storage">;
    attachmentName?: string;
    attachmentMimeType?: string;
    attachmentSize?: number;
  }) => Promise<unknown>;
  generateUploadUrl: (args: Record<string, never>) => Promise<string>;
  setTyping: (args: {
    conversationId: Id<"conversations">;
    isTyping: boolean;
  }) => Promise<unknown>;
  dispatchUi: ChatUiDispatch;
};

export function useChatActions({
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
}: Params) {
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
    dispatchUi,
    generateUploadUrl,
    replyTarget,
    scrollToLatestMessage,
    selectedConversationId,
    sendMessage,
    setDraftAttachment,
    setDraftMessage,
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
    [dispatchUi, openOrCreateConversation, setSelectedConversationId],
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
  }, [dispatchUi, normalizedSearchTerm]);

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
    [dispatchUi, setSelectedConversationId],
  );

  const onMessageListScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
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
    [dispatchUi, saveConversationScroll, selectedConversationId],
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
  }, [dispatchUi, forwardConversationId, forwardPayload, sendMessage]);

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
    dispatchUi,
    failedMessageDraft,
    scrollToLatestMessage,
    selectedConversationId,
    sendMessage,
    setDraftMessage,
  ]);

  return {
    sendCurrentDraft,
    onOpenConversation,
    onCopyInvite,
    onSelectConversation,
    onMessageListScroll,
    onForwardConfirm,
    onRetrySend,
  };
}
