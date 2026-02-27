import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a Jigsaw account to start chatting in real time.",
};

export default function SignUpPage() {
  const isClerkConfigured =
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    Boolean(process.env.CLERK_SECRET_KEY);

  return (
    <AuthPageShell
      isClerkConfigured={isClerkConfigured}
      fallbackText="Configure Clerk keys in `.env.local` before using sign-up."
    >
      <SignUp path="/auth/sign-up" routing="path" />
    </AuthPageShell>
  );
}
