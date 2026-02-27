type Props = {
  isClerkConfigured: boolean;
  fallbackText: string;
  children: React.ReactNode;
};

export function AuthPageShell({
  isClerkConfigured,
  fallbackText,
  children,
}: Props) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      {isClerkConfigured ? (
        children
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {fallbackText}
        </p>
      )}
    </main>
  );
}
