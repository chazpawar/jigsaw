import type { Id } from "@convex/_generated/dataModel";
import type { ForwardPayload, ReplyTarget } from "./model";

export type ChatUiState = {
  mobileView: "list" | "chat";
  sidebarCollapsed: boolean;
  unseenIncomingCount: number;
  isSending: boolean;
  sendError: string | null;
  conversationActionError: string | null;
  failedMessageDraft: string | null;
  activeReactionMessageId: Id<"messages"> | null;
  activeMessageMenuId: Id<"messages"> | null;
  selectedMessageIds: Id<"messages">[];
  pinnedMessageId: Id<"messages"> | null;
  replyTarget: ReplyTarget | null;
  isForwardModalOpen: boolean;
  forwardPayload: ForwardPayload | null;
  forwardSearchTerm: string;
  forwardConversationId: Id<"conversations"> | null;
  forwardError: string | null;
  isForwarding: boolean;
  inviteFeedback: string | null;
  inviteError: string | null;
};

export const initialChatUiState: ChatUiState = {
  mobileView: "list",
  sidebarCollapsed: false,
  unseenIncomingCount: 0,
  isSending: false,
  sendError: null,
  conversationActionError: null,
  failedMessageDraft: null,
  activeReactionMessageId: null,
  activeMessageMenuId: null,
  selectedMessageIds: [],
  pinnedMessageId: null,
  replyTarget: null,
  isForwardModalOpen: false,
  forwardPayload: null,
  forwardSearchTerm: "",
  forwardConversationId: null,
  forwardError: null,
  isForwarding: false,
  inviteFeedback: null,
  inviteError: null,
};

type ChatUiAction =
  | { type: "patch"; payload: Partial<ChatUiState> }
  | { type: "resetConversationUi" }
  | { type: "toggleSelectedMessage"; messageId: Id<"messages"> }
  | { type: "incrementUnseen"; by: number };

export function chatUiReducer(
  state: ChatUiState,
  action: ChatUiAction,
): ChatUiState {
  switch (action.type) {
    case "patch": {
      const entries = Object.entries(action.payload) as Array<
        [keyof ChatUiState, ChatUiState[keyof ChatUiState]]
      >;

      if (entries.every(([key, value]) => state[key] === value)) {
        return state;
      }

      return { ...state, ...action.payload };
    }
    case "resetConversationUi":
      return {
        ...state,
        activeReactionMessageId: null,
        activeMessageMenuId: null,
        selectedMessageIds: [],
        pinnedMessageId: null,
        replyTarget: null,
        isForwardModalOpen: false,
        forwardPayload: null,
        forwardSearchTerm: "",
        forwardConversationId: null,
        forwardError: null,
      };
    case "toggleSelectedMessage":
      return {
        ...state,
        selectedMessageIds: state.selectedMessageIds.includes(action.messageId)
          ? state.selectedMessageIds.filter((id) => id !== action.messageId)
          : [...state.selectedMessageIds, action.messageId],
      };
    case "incrementUnseen":
      if (action.by === 0) {
        return state;
      }

      return {
        ...state,
        unseenIncomingCount: state.unseenIncomingCount + action.by,
      };
    default:
      return state;
  }
}
