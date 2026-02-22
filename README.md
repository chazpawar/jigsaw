# Jigsaw Chat

Phase 1 foundation setup for a real-time messaging app built with:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Clerk authentication
- Convex backend client wiring

## 1) Install dependencies

```bash
npm install
```

## 2) Configure environment variables

Copy `.env.example` to `.env.local` and fill in values from Clerk and Convex.

```bash
cp .env.example .env.local
```

Required values:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_JWT_ISSUER_DOMAIN`
- `NEXT_PUBLIC_CONVEX_URL`

## 3) Run development server

```bash
npm run dev
```

Open `http://localhost:3000`.

- Unauthenticated users land on the auth entry page.
- Sign in/up routes are available at `/auth/sign-in` and `/auth/sign-up`.
- Authenticated users are redirected to `/chat`, a protected app shell.

## Phase 1 deliverables covered

- Stack configured and app boots
- Clerk wired in root providers and middleware-protected routes
- Convex React client provider integrated with Clerk auth
- Responsive chat shell scaffold (sidebar + chat panel)
- Reusable UI primitive (`Button`) for consistent actions
