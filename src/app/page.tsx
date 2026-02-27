import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Jigsaw Chat",
  description: "Sign in to access the Jigsaw real-time messaging workspace.",
};

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/chat");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#eff6ff,_#f8fafc_52%,_#ffffff)] px-6 py-10">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-xl shadow-slate-200/60 backdrop-blur md:p-12">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Jigsaw Chat
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            Real-time messaging, ready for your team.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
            Sign in to open the chat workspace. Foundation setup includes Clerk
            authentication, Convex wiring, and a responsive app shell.
          </p>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild href="/auth/sign-in" className="h-11 px-6">
            Sign in
          </Button>
          <Button
            asChild
            href="/auth/sign-up"
            variant="secondary"
            className="h-11 px-6"
          >
            Create account
          </Button>
        </div>
      </div>
    </main>
  );
}
