import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    inviterName?: string;
  } | null;

  const targetEmail = body?.email?.trim().toLowerCase();

  if (!targetEmail || !isValidEmailAddress(targetEmail)) {
    return NextResponse.json(
      { error: "Please provide a valid email address." },
      { status: 400 },
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const inviteFromEmail = process.env.INVITE_FROM_EMAIL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!resendApiKey || !inviteFromEmail) {
    return NextResponse.json(
      { error: "Email service is not configured yet." },
      { status: 500 },
    );
  }

  const resend = new Resend(resendApiKey);

  const inviterName = body?.inviterName?.trim() || "A friend";
  const safeInviterName = escapeHtml(inviterName);

  const { error } = await resend.emails.send({
    from: inviteFromEmail,
    to: [targetEmail],
    subject: `${inviterName} invited you to Jigsaw Chat`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111"><h2 style="margin:0 0 12px">You are invited to Jigsaw Chat</h2><p style="margin:0 0 12px">${safeInviterName} wants to chat with you on Jigsaw.</p><p style="margin:0 0 18px">Create your account to start messaging in real time.</p><a href="${appUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px">Open Jigsaw</a></div>`,
  });

  if (error) {
    return NextResponse.json(
      {
        error: "Invite email failed to send.",
        details: error.message,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
