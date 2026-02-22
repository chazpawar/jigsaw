import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const isClerkConfigured =
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    Boolean(process.env.CLERK_SECRET_KEY);

  if (!isClerkConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#eff6ff,_#f8fafc_52%,_#ffffff)] px-6 py-10">
        <div className="w-full max-w-3xl rounded-3xl border border-amber-200 bg-amber-50/80 p-8 shadow-xl shadow-amber-100/60 backdrop-blur md:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
            Configuration needed
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-amber-900 md:text-4xl">
            Add Clerk and Convex keys to run authentication.
          </h1>
          <p className="mt-3 text-base leading-7 text-amber-800/90">
            Copy `.env.example` to `.env.local`, add your keys, and restart the
            dev server.
          </p>
        </div>
      </main>
    );
  }

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
