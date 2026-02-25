import type { Id } from "@convex/_generated/dataModel";
import { ArrowRight, MagnifyingGlass, X } from "@phosphor-icons/react";
import { ForwardModal } from "./layout-sections";
import type { ForwardPayload, SidebarConversation } from "./model";

type Props = {
  isOpen: boolean;
  close: () => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  conversations: SidebarConversation[];
  selectedConversationId: Id<"conversations"> | null;
  setSelectedConversationId: (value: Id<"conversations"> | null) => void;
  payload: ForwardPayload | null;
  error: string | null;
  isForwarding: boolean;
  onForward: () => Promise<void>;
};

export function ChatForwardModal({
  isOpen,
  close,
  searchTerm,
  setSearchTerm,
  conversations,
  selectedConversationId,
  setSelectedConversationId,
  payload,
  error,
  isForwarding,
  onForward,
}: Props) {
  if (!isOpen) {
    return null;
  }

  return (
    <ForwardModal>
      <div className="w-full max-w-sm rounded-2xl bg-[#2f3035] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-100">
            Forward To
          </h3>
          <button
            type="button"
            onClick={close}
            className="rounded-full p-1 text-neutral-300 hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <label className="mb-3 flex h-10 items-center gap-2 rounded-lg bg-[#484950] px-3 text-neutral-300">
          <MagnifyingGlass size={15} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Name, username, or email"
            className="h-full w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
          />
        </label>

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="px-2 py-3 text-sm text-neutral-400">
              No conversations found.
            </p>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation._id}
                type="button"
                onClick={() => setSelectedConversationId(conversation._id)}
                className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition ${
                  selectedConversationId === conversation._id
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
                    selectedConversationId === conversation._id
                      ? "border-transparent bg-blue-500"
                      : "border-neutral-500"
                  }`}
                />
              </button>
            ))
          )}
        </div>

        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={!selectedConversationId || !payload || isForwarding}
            onClick={async () => {
              await onForward();
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowRight size={18} weight="bold" />
          </button>
        </div>
      </div>
    </ForwardModal>
  );
}
