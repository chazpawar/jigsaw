import { Paperclip, PaperPlaneTilt, X } from "@phosphor-icons/react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Composer } from "./layout-sections";
import type { ReplyTarget } from "./model";

type Props = {
  sendError: string | null;
  failedMessageDraft: string | null;
  selectedConversationIdPresent: boolean;
  onRetry: () => Promise<void>;
  replyTarget: ReplyTarget | null;
  clearReplyTarget: () => void;
  draftAttachment: File | null;
  clearAttachment: () => void;
  formatFileSize: (size?: number) => string;
  attachmentInputRef: RefObject<HTMLInputElement | null>;
  onAttachmentChange: (file: File | null) => void;
  draftMessage: string;
  setDraftMessage: (value: string) => void;
  isSending: boolean;
  canSend: boolean;
  sendCurrentDraft: () => Promise<void>;
};

export function ChatComposer({
  sendError,
  failedMessageDraft,
  selectedConversationIdPresent,
  onRetry,
  replyTarget,
  clearReplyTarget,
  draftAttachment,
  clearAttachment,
  formatFileSize,
  attachmentInputRef,
  onAttachmentChange,
  draftMessage,
  setDraftMessage,
  isSending,
  canSend,
  sendCurrentDraft,
}: Props) {
  return (
    <Composer>
      {sendError ? (
        <div className="mb-2 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
          <div className="flex items-center justify-between gap-2">
            <span>{sendError}</span>
            {failedMessageDraft && selectedConversationIdPresent ? (
              <button
                type="button"
                className="rounded-md border border-rose-500/40 px-2 py-1 text-[11px] font-medium text-rose-200"
                onClick={async () => {
                  await onRetry();
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
            onClick={clearReplyTarget}
          >
            <X size={12} />
          </button>
        </div>
      ) : null}

      {draftAttachment ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-xs text-neutral-300">
          <span className="truncate">
            📎 {draftAttachment.name} ({formatFileSize(draftAttachment.size)})
          </span>
          <button
            type="button"
            className="rounded-md bg-neutral-800 px-2 py-1 text-[11px] text-neutral-200"
            onClick={clearAttachment}
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
            onAttachmentChange(file);
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

            if (!canSend) {
              return;
            }

            event.preventDefault();
            void sendCurrentDraft();
          }}
          rows={1}
          placeholder="Message"
          className="h-11 max-h-32 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto rounded-xl bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 outline-none ring-offset-2 placeholder:text-neutral-500 "
        />
        <Button
          type="button"
          onClick={() => {
            void sendCurrentDraft();
          }}
          className="h-11 shrink-0 self-center px-5"
          disabled={!canSend}
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
    </Composer>
  );
}
