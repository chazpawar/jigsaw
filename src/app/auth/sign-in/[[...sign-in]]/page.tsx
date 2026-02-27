import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to continue to Jigsaw chat.",
};

export default function SignInPage() {
  const isClerkConfigured =
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    Boolean(process.env.CLERK_SECRET_KEY);

  return (
    <AuthPageShell
      isClerkConfigured={isClerkConfigured}
      fallbackText="Configure Clerk keys in `.env.local` before using sign-in."
    >
      <SignIn path="/auth/sign-in" routing="path" />
    </AuthPageShell>
  );
}
