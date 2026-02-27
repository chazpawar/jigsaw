import type { Id } from "@convex/_generated/dataModel";
import type { UIEvent } from "react";
import { formatMessageTime } from "@/lib/time";
import { ChatComposer } from "./chat-composer";
import { ChatForwardModal } from "./chat-forward-modal";
import { ChatMessageList } from "./chat-message-list";
import { previewText } from "./chat-utils";
import type {
  ConversationOverview,
  Message,
  SidebarConversation,
  TypingState,
} from "./model";
import type { ChatUiDispatch, ChatUiState } from "./ui-state";

type Props = {
  isMobileChatOpen: boolean;
  selectedConversationId: Id<"conversations"> | null;
  selectedConversationLabel: string;
  selectedConversation: ConversationOverview | null | undefined;
  headerTimestamp: string | null;
  messageScrollRef: React.RefObject<HTMLDivElement | null>;
  onMessageListScroll: (event: UIEvent<HTMLDivElement>) => void;
  isMessagesLoading: boolean;
  messages: Message[];
  typingState: TypingState | null;
  ui: ChatUiState;
  dispatchUi: ChatUiDispatch;
  forwardableConversations: SidebarConversation[];
  onForwardConfirm: () => Promise<void>;
  onRetrySend: () => Promise<void>;
  sendCurrentDraft: () => Promise<void>;
  draftAttachment: File | null;
  setDraftAttachment: (value: File | null) => void;
  attachmentInputRef: React.RefObject<HTMLInputElement | null>;
  draftMessage: string;
  setDraftMessage: (value: string) => void;
  formatFileSize: (size?: number) => string;
  softDeleteMessage: (args: { messageId: Id<"messages"> }) => Promise<unknown>;
  toggleReaction: (args: {
    messageId: Id<"messages">;
    emoji: "👍" | "❤️" | "😂" | "😮" | "😢";
  }) => Promise<unknown>;
};

export function ChatConversationPane({
  isMobileChatOpen,
  selectedConversationId,
  selectedConversationLabel,
  selectedConversation,
  headerTimestamp,
  messageScrollRef,
  onMessageListScroll,
  isMessagesLoading,
  messages,
  typingState,
  ui,
  dispatchUi,
  forwardableConversations,
  onForwardConfirm,
  onRetrySend,
  sendCurrentDraft,
  draftAttachment,
  setDraftAttachment,
  attachmentInputRef,
  draftMessage,
  setDraftMessage,
  formatFileSize,
  softDeleteMessage,
  toggleReaction,
}: Props) {
  return (
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
            selectedMessageIds={ui.selectedMessageIds}
            activeMessageMenuId={ui.activeMessageMenuId}
            activeReactionMessageId={ui.activeReactionMessageId}
            pinnedMessageId={ui.pinnedMessageId}
            typingState={typingState}
            unseenIncomingCount={ui.unseenIncomingCount}
            onToggleMenu={(messageId) => {
              dispatchUi({
                type: "patch",
                payload: { activeReactionMessageId: null },
              });
              dispatchUi({
                type: "patch",
                payload: {
                  activeMessageMenuId:
                    ui.activeMessageMenuId === messageId ? null : messageId,
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
                      message.body || message.attachmentName || "Attachment",
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
                    ui.activeReactionMessageId === messageId ? null : messageId,
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
            isOpen={ui.isForwardModalOpen}
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
            searchTerm={ui.forwardSearchTerm}
            setSearchTerm={(value) => {
              dispatchUi({
                type: "patch",
                payload: { forwardSearchTerm: value },
              });
            }}
            conversations={forwardableConversations}
            selectedConversationId={ui.forwardConversationId}
            setSelectedConversationId={(value) => {
              dispatchUi({
                type: "patch",
                payload: { forwardConversationId: value },
              });
            }}
            payload={ui.forwardPayload}
            error={ui.forwardError}
            isForwarding={ui.isForwarding}
            onForward={onForwardConfirm}
          />

          <ChatComposer
            sendError={ui.sendError}
            failedMessageDraft={ui.failedMessageDraft}
            selectedConversationIdPresent={Boolean(selectedConversationId)}
            onRetry={onRetrySend}
            replyTarget={ui.replyTarget}
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
            isSending={ui.isSending}
            canSend={Boolean(
              !ui.isSending && (draftMessage.trim() || draftAttachment),
            )}
            sendCurrentDraft={sendCurrentDraft}
          />
        </>
      )}
    </section>
  );
}
