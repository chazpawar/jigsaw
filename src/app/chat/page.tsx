import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/chat/app-shell";

export default async function ChatPage() {
  const isClerkConfigured =
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    Boolean(process.env.CLERK_SECRET_KEY);

  if (!isClerkConfigured) {
    redirect("/");
  }

  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <AppShell />;
}
