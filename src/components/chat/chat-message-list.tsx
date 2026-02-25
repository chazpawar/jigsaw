import type { Id } from "@convex/_generated/dataModel";
import {
  ArrowBendUpLeft,
  ArrowBendUpRight,
  CheckCircle,
  CopySimple,
  DotsThree,
  Info,
  PushPin,
  Smiley,
  Trash,
} from "@phosphor-icons/react";
import Image from "next/image";
import type { RefObject, UIEvent } from "react";
import { formatMessageTime } from "@/lib/time";
import { REACTION_SET } from "./chat-utils";
import { MessageList } from "./layout-sections";
import type { Message, TypingState } from "./model";

type Props = {
  messageScrollRef: RefObject<HTMLDivElement | null>;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  isMessagesLoading: boolean;
  messages: Message[];
  selectedMessageIds: Id<"messages">[];
  activeMessageMenuId: Id<"messages"> | null;
  activeReactionMessageId: Id<"messages"> | null;
  pinnedMessageId: Id<"messages"> | null;
  typingState: TypingState | null;
  unseenIncomingCount: number;
  onToggleMenu: (messageId: Id<"messages">) => void;
  onSetReply: (message: Message) => void;
  onToggleReactionPicker: (messageId: Id<"messages">) => void;
  onSelectMessage: (messageId: Id<"messages">) => void;
  onCopyText: (message: Message) => Promise<void>;
  onForwardMessage: (message: Message) => void;
  onPinMessage: (messageId: Id<"messages">) => void;
  onInfoMessage: (createdAt: number) => void;
  onDeleteMessage: (message: Message) => Promise<void>;
  onPickReaction: (
    messageId: Id<"messages">,
    emoji: "👍" | "❤️" | "😂" | "😮" | "😢",
  ) => Promise<void>;
  onToggleCurrentReaction: (message: Message) => Promise<void>;
  onJumpToLatest: () => void;
  formatFileSize: (size?: number) => string;
};

export function ChatMessageList({
  messageScrollRef,
  onScroll,
  isMessagesLoading,
  messages,
  selectedMessageIds,
  activeMessageMenuId,
  activeReactionMessageId,
  pinnedMessageId,
  typingState,
  unseenIncomingCount,
  onToggleMenu,
  onSetReply,
  onToggleReactionPicker,
  onSelectMessage,
  onCopyText,
  onForwardMessage,
  onPinMessage,
  onInfoMessage,
  onDeleteMessage,
  onPickReaction,
  onToggleCurrentReaction,
  onJumpToLatest,
  formatFileSize,
}: Props) {
  return (
    <MessageList ref={messageScrollRef} onScroll={onScroll}>
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
                  message.isMine ? "right-full mr-2" : "left-full ml-2"
                }`}
              >
                <button
                  type="button"
                  aria-label="More options"
                  onClick={() => onToggleMenu(message._id)}
                  className="flex size-6 items-center justify-center rounded-full text-xs text-neutral-200"
                >
                  <DotsThree size={16} weight="bold" />
                </button>
                <button
                  type="button"
                  aria-label="Reply to message"
                  onClick={() => onSetReply(message)}
                  className="flex size-6 items-center justify-center rounded-full text-xs text-neutral-200"
                >
                  <ArrowBendUpLeft size={14} weight="bold" />
                </button>
                <button
                  type="button"
                  aria-label="Add reaction"
                  onClick={() => onToggleReactionPicker(message._id)}
                  className="flex size-6 items-center justify-center rounded-full text-xs text-neutral-200"
                >
                  <Smiley size={14} weight="duotone" />
                </button>
              </div>

              {activeMessageMenuId === message._id ? (
                <div
                  className={`absolute top-0 z-30 max-h-[70vh] min-w-40 overflow-y-auto rounded-xl bg-[#3a3a3f] p-2 text-xs shadow-xl ${
                    message.isMine ? "right-full mr-14" : "left-full ml-14"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectMessage(message._id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-neutral-100 hover:bg-white/10"
                  >
                    <CheckCircle size={14} />
                    Select
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onCopyText(message);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-neutral-100 hover:bg-white/10"
                  >
                    <CopySimple size={14} />
                    Copy text
                  </button>
                  <button
                    type="button"
                    onClick={() => onForwardMessage(message)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-neutral-100 hover:bg-white/10"
                  >
                    <ArrowBendUpRight size={14} />
                    Forward message
                  </button>
                  <button
                    type="button"
                    onClick={() => onPinMessage(message._id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-neutral-100 hover:bg-white/10"
                  >
                    <PushPin size={14} />
                    Pin
                  </button>
                  <button
                    type="button"
                    onClick={() => onInfoMessage(message.createdAt)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-neutral-100 hover:bg-white/10"
                  >
                    <Info size={14} />
                    Info
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteMessage(message);
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
                    message.isMine ? "right-full mr-14" : "left-full ml-14"
                  }`}
                >
                  {REACTION_SET.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={async () => {
                        await onPickReaction(message._id, emoji);
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
                      message.isMine ? "text-[#b9d5ff]" : "text-[#6ae9cb]"
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
                    <Image
                      src={message.attachmentUrl}
                      alt={message.attachmentName ?? "Attachment"}
                      width={640}
                      height={420}
                      unoptimized
                      className="max-h-64 h-auto w-full rounded-xl object-cover"
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
                  message.isMine ? "text-neutral-300" : "text-neutral-400"
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
                      await onToggleCurrentReaction(message);
                    }}
                    className={`rounded-full border border-black/80 bg-[#2a2a2a] px-2 py-0.5 text-[11px] text-neutral-100 shadow-sm ${
                      message.reactions[0]?.reactedByMe ? "bg-[#343434]" : ""
                    }`}
                  >
                    {message.reactions[0]?.emoji}
                    {message.reactions[0] && message.reactions[0].count > 1
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
          onClick={onJumpToLatest}
          className="sticky bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow"
        >
          ↓ New messages ({unseenIncomingCount})
        </button>
      ) : null}
    </MessageList>
  );
}
