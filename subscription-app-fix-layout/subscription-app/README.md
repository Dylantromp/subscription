# Subscription & Membership App – Next.js + Postgres

## Quick Start
1. Create a Postgres DB (Neon/Supabase/local).
2. Copy `.env.example` → `.env` and fill `DATABASE_URL` and `SESSION_SECRET`.
3. Install deps:
   ```bash
   npm i
   ```
4. Apply schema & seed:
   ```bash
   npm run db:push
   ```
5. Run dev:
   ```bash
   npm run dev
   ```
6. Open http://localhost:3000 and click **Start Trial**.

## Deploy on Vercel
- Import this repo to Vercel.
- Set `DATABASE_URL` (and `SESSION_SECRET`) in Project → Settings → Environment Variables.
- Run migrations once:
  ```bash
  vercel exec npm run db:push
  ```

## API routes
- POST `/api/subscriptions` → create subscription for account "Airlec, Inc."
- POST `/api/invoices` → invoice for latest subscription
- POST `/api/usage` → log & roll up usage
- GET  `/api/entitlements?subscriptionId=...&feature=projects.max`

All timestamps use `TIMESTAMP WITHOUT TIME ZONE`.
