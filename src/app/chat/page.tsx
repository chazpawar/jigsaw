import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/chat/app-shell";

export const metadata: Metadata = {
  title: "Chat Workspace",
  description: "Realtime chat workspace for direct and group conversations.",
};

export default async function ChatPage() {
  const isClerkConfigured =
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    Boolean(process.env.CLERK_SECRET_KEY);

  if (!isClerkConfigured) {
    redirect("/");
  }

  const { userId } = await auth();

  if (!userId) {
    redirect("/auth/sign-in");
  }

  return <AppShell />;
}
