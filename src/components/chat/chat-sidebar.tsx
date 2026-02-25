import { UserButton } from "@clerk/nextjs";
import type { Id } from "@convex/_generated/dataModel";
import { List } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { formatMessageTimestamp } from "@/lib/time";
import { ChatAvatar } from "./chat-avatar";
import { isOnlineNow } from "./chat-utils";
import type { DiscoverableUser, SidebarConversation } from "./model";

type Props = {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  clearInviteMessages: () => void;
  conversationActionError: string | null;
  hasSearch: boolean;
  hasValidSearchEmail: boolean;
  isDiscoverableUsersLoading: boolean;
  matchedUser: DiscoverableUser | null;
  normalizedSearchTerm: string;
  canSendInvite: boolean;
  onOpenConversation: (peerUserId: Id<"users">) => Promise<void>;
  onCopyInvite: () => Promise<void>;
  inviteFeedback: string | null;
  inviteError: string | null;
  isConversationsLoading: boolean;
  conversations: SidebarConversation[];
  selectedConversationId: Id<"conversations"> | null;
  onSelectConversation: (conversationId: Id<"conversations">) => void;
};

export function ChatSidebar({
  sidebarCollapsed,
  onToggleSidebar,
  searchTerm,
  setSearchTerm,
  clearInviteMessages,
  conversationActionError,
  hasSearch,
  hasValidSearchEmail,
  isDiscoverableUsersLoading,
  matchedUser,
  normalizedSearchTerm,
  canSendInvite,
  onOpenConversation,
  onCopyInvite,
  inviteFeedback,
  inviteError,
  isConversationsLoading,
  conversations,
  selectedConversationId,
  onSelectConversation,
}: Props) {
  if (sidebarCollapsed) {
    return (
      <>
        <div className="flex h-16 items-center justify-center">
          <button
            type="button"
            className="rounded-xl p-2 text-lg text-neutral-300 hover:bg-[#2a2b2f]"
            onClick={onToggleSidebar}
            aria-label="Expand sidebar"
          >
            <List size={18} weight="bold" />
          </button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-3">
          {conversations.map((conversation) => {
            const avatarName =
              conversation.otherUser?.displayName ?? conversation.title;
            const avatarImage = conversation.otherUser?.imageUrl;
            const isSelected = conversation._id === selectedConversationId;

            return (
              <button
                key={conversation._id}
                type="button"
                onClick={() => onSelectConversation(conversation._id)}
                className={`mx-auto flex w-14 items-center justify-center rounded-xl p-1.5 transition ${
                  isSelected ? "bg-[#4a4b50]" : "hover:bg-[#2a2b2f]"
                }`}
                aria-label={conversation.title}
                title={conversation.title}
              >
                <ChatAvatar name={avatarName} imageUrl={avatarImage} />
              </button>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex h-16 items-center justify-between px-4 md:px-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-lg text-neutral-300"
            onClick={onToggleSidebar}
            aria-label="Collapse sidebar"
          >
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
            clearInviteMessages();
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
                await onOpenConversation(matchedUser._id);
              }}
            >
              <div className="relative">
                <ChatAvatar
                  name={matchedUser.displayName}
                  imageUrl={matchedUser.imageUrl}
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 block size-2.5 rounded-full border border-white ${
                    isOnlineNow(matchedUser.lastSeenAt, matchedUser.isOnline)
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
                    await onCopyInvite();
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
              const isSelected = conversation._id === selectedConversationId;
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
                  onClick={() => onSelectConversation(conversation._id)}
                  className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${
                    isSelected
                      ? "bg-[#4a4b50]"
                      : "bg-transparent hover:bg-[#3a3b40]"
                  }`}
                >
                  <div className="relative">
                    <ChatAvatar name={avatarName} imageUrl={avatarImage} />
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
                          conversation.lastMessageAt ?? conversation.updatedAt,
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
    </>
  );
}
