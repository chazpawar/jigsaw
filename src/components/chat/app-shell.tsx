import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function AppShell() {
  return (
    <main className="min-h-screen bg-slate-100 p-3 md:p-6">
      <div className="mx-auto flex h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70 md:h-[calc(100vh-3rem)] md:flex-row">
        <aside className="border-b border-slate-200 bg-slate-50 md:flex md:w-80 md:flex-col md:border-b-0 md:border-r">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 md:px-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Jigsaw Chat
              </p>
              <h1 className="text-lg font-semibold text-slate-900">
                Conversations
              </h1>
            </div>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "size-9",
                },
              }}
              afterSignOutUrl="/"
            />
          </div>
          <div className="space-y-4 px-4 py-4 md:px-5">
            <Button variant="secondary" className="w-full justify-start">
              New conversation
            </Button>
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
              User directory and live search will be added in Phase 2.
            </div>
          </div>
        </aside>

        <section className="flex flex-1 flex-col">
          <header className="border-b border-slate-200 px-4 py-3 md:px-6">
            <h2 className="text-base font-semibold text-slate-900 md:text-lg">
              Select a conversation
            </h2>
            <p className="text-sm text-slate-500">
              The real-time message panel will be wired in the next phase.
            </p>
          </header>

          <div className="flex flex-1 items-center justify-center p-6">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-sm font-medium text-slate-700">
                Foundation complete
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Authenticated users are now inside a protected workspace shell.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
