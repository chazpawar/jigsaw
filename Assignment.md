Tech Stack:
You must use the following:
Next.js (App Router): Docs
TypeScript: Docs
Convex (backend, database, realtime): Docs: Next.js Quickstart
Clerk (authentication): Docs: Convex + Clerk Setup
For styling, use Tailwind CSS as the base. You may use any Tailwind-based
component library: shadcn/ui (recommended), Radix UI, Headless UI, or
plain Tailwind.
Convex, Clerk, and Vercel have generous free tiers: no cost to you.
Functional Requirements:
Build the following features in order. Each one builds on the previous, so it’s
easier to implement one by one. You can also take liberty in how to code the
features if you believe you know a better solution, descriptions are just mere
suggestions.

Tars Full stack Engineer Internship Coding Challenge 2026 - Using AI-Assisted Tool is allowed 2

1. Authentication: Set up Clerk so users can sign up (email or social login),
log in, and log out. Display the logged-in user's name and avatar. Store user
profiles in Convex so other users can discover them.
2. User List & Search: Show all registered users (excluding yourself). Add a
search bar that filters users by name as you type. Clicking a user opens or
creates a conversation with them.
3. One-on-One Direct Messages: Users can have private conversations.
Messages appear in real time for both sides using Convex subscriptions.
Show a sidebar listing all conversations with a preview of the most recent
message.
4. Message Timestamps: Show when each message was sent. Today's
messages show time only (2:34 PM), older messages show date + time
(Feb 15, 2:34 PM), and messages from a different year include the year.
5. Empty States: Show helpful messages when there's nothing to display: no
conversations yet, no messages in a conversation, no search results. Don't
leave blank screens.
6. Responsive Layout: Desktop: sidebar + chat area side by side. Mobile:
conversation list as default view, Tapping a conversation opens full-screen
chat with a back button. Use Tailwind responsive breakpoints.
7. Online/Offline Status: Show a green indicator next to users who currently
have the app open. Update in real time when users come online or go
offline.
8. Typing Indicator: Show "Alex is typing..." or a pulsing dots animation when
the other user is typing. Disappear after ~2 seconds of inactivity or when
the message is sent.
9. Unread Message Count: Show a badge on each conversation in the
sidebar with the number of unread messages. Clear the badge when the
user opens that conversation. Update in real time.
10. Smart Auto-Scroll: Scroll to the latest message automatically when new
messages arrive. If the user has scrolled up to read older messages, don't
force-scroll; show a "↓ New messages" button instead.
The following ones(11-14) are optional, but if you have time, you can
implement them.

Tars Full stack Engineer Internship Coding Challenge 2026 - Using AI-Assisted Tool is allowed 3

11. Delete Own Messages: Users can delete messages they sent. Show "This
message was deleted" in italics for all users. Use soft delete: don't remove
the record from Convex.
12. Message Reactions: Users can react to any message with a fixed set of
emojis (👍 ❤️ 😂 😮 😢). Clicking the same reaction again removes it. Show
reaction counts below the message.
13. Loading & Error States: Show skeleton loaders or spinners while data is
loading. If a message fails to send, show an error with a retry option.
Handle network/service errors gracefully.
14. Group Chat: Users can create a group conversation by picking multiple
members and giving it a name. All members see messages in real time.
Show group name and member count in the sidebar.







Evaluation Criteria:

Tars Full stack Engineer Internship Coding Challenge 2026 - Using AI-Assisted Tool is allowed 4

Your submission will be evaluated on the following parameters:
1. Features Completed: How many of the listed features work correctly? We'd
rather see 10 features done well than 14 done sloppily.
2. Code Quality: Clean, readable code. Sensible file structure. Proper use of
TypeScript. No obvious copy-paste mess.
3. Schema Design: How you structured your Convex tables. Is it clean and
extensible?
4. UI/UX Polish: Does the app feel good to use? Responsive, no broken
layouts, good empty/loading states.