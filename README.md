# Bamyon-IMS — Phase 1-5 (v1 zip)

Import Management & Storefront System. This zip contains a real, runnable
Next.js + Firebase codebase — not a mockup. See `BUILD_DOCUMENTATION.md` for
exactly what's implemented, what's stubbed, and what's next.

## 1. Prerequisites

- Node.js 18.18+
- A Firebase project (Firestore + Authentication enabled)
- A Paystack account (test mode is fine to start)
- A Vercel account for deployment

## 2. Install

```bash
npm install
cp .env.local.example .env.local
```

Fill in `.env.local`:

- `NEXT_PUBLIC_FIREBASE_*` — from Firebase console → Project settings → Web app.
  This is the **client SDK config only** — there is no service-account JSON
  anywhere in this project.
- `NEXT_PUBLIC_STORE_ID` — pick a slug for your store, e.g. `bamyon-demo-store`.
  Every Firestore document this app writes/reads lives under
  `/stores/{that value}/...`.
- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` / `PAYSTACK_SECRET_KEY` — from your
  Paystack dashboard. The secret key must **never** get a `NEXT_PUBLIC_`
  prefix — it's only read inside `app/api/*` route handlers on the server.
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `_SECRET` — for
  the media upload signing route (ships in the next zip alongside the admin
  product-image uploader; the env vars are wired up now so you can create the
  Cloudinary account ahead of time).

## 3. Firebase setup

1. In the Firebase console, enable **Authentication** → Email/Password and
   Google sign-in providers.
2. Enable **Firestore** (production mode).
3. Deploy the security rules and indexes in this repo:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add   # select your project
   firebase deploy --only firestore:rules,firestore:indexes
   ```

4. Create the `stores/{NEXT_PUBLIC_STORE_ID}` document by hand once, with at
   least:

   ```json
   {
     "id": "bamyon-demo-store",
     "name": "Your Store Name",
     "slug": "bamyon-demo-store",
     "baseCurrency": "NGN",
     "enabledCurrencies": ["NGN"],
     "branding": {},
     "theme": { /* copy from src/lib/theme/tokens.ts DEFAULT_THEME */ },
     "featureFlags": { "community": false, "courses": false, "affiliate": true, "referrals": true, "wallet": true, "pos": false },
     "createdAt": 0,
     "updatedAt": 0
   }
   ```

### 3a. System actor setup (required for wallet top-ups & Paystack order payments)

This project intentionally has **no Firebase Admin SDK / service account**.
Server routes (`app/api/*`) that need to write trusted data (crediting a
verified deposit, marking an order paid) instead sign in as a dedicated
Firebase Auth user whose Firestore role is `"system"`. Full rationale is in
`src/lib/firebase/systemAuth.ts`. One-time setup:

1. In Firebase Auth, create a user, e.g. `system@internal.<yourstore>.app`,
   with a strong generated password.
2. Manually create its Firestore profile at
   `/stores/{storeId}/users/{that user's uid}` with `"role": "system"` (every
   other user document is created automatically on sign-up with role
   `"customer"` — this is the one exception).
3. In Vercel → Project → Settings → Environment Variables, set
   `BAMYON_SYSTEM_EMAIL` and `BAMYON_SYSTEM_PASSWORD` as **server-only**
   (do not prefix with `NEXT_PUBLIC_`).

### 3b. First admin account

Visit **`/setup`** after registering an account — it creates the store
document and lets you claim admin, entirely from the UI (see
`lib/firestore/setup.ts`). No manual Firestore console work needed here
anymore. (Step 4 above still requires manually creating the `/stores/{storeId}`
document *if* you skip `/setup` and prefer the console — `/setup` is the
recommended path.)

### 3c. Staff logins

Once you're admin, go to `/admin/staff` and use "Invite staff member" to
create a real login directly (name, email, permissions) — the system
hands back a generated password immediately for you to share. No email
system required, no separate signup step for them.

## 4. Paystack webhook

In the Paystack dashboard, set your webhook URL to:

```
https://<your-vercel-domain>/api/webhooks/paystack
```

The route verifies the `x-paystack-signature` header against
`PAYSTACK_SECRET_KEY` and re-verifies every transaction against Paystack's
REST API before crediting anything — see `src/app/api/webhooks/paystack/route.ts`.

## 5. Run locally

```bash
npm run dev
```

## 6. Deploy

Push to a Git repo and import it into Vercel, or `vercel --prod`. Set all the
environment variables above in the Vercel project settings first (both
Production and Preview environments if you want preview deploys to work).

## Project structure

```
src/
  types/            Firestore data model (source of truth for shapes)
  lib/
    firebase/       Client SDK init + the server-only "system" actor
    auth/            AuthProvider, permission helpers
    firestore/       All Firestore reads/writes, one file per domain
    payments/        Paystack REST client (server-only)
    theme/           Runtime theme (CSS vars driven by the store doc)
    money.ts          Integer minor-unit money helpers
  components/
    ui/ storefront/ admin/
  app/
    (storefront pages, /account, /admin, /api/*)
firestore.rules       The real authorization boundary
firestore.indexes.json
```

## A note on architecture decisions

Two decisions in this codebase exist specifically because of the "no service
account" constraint, and are worth understanding before you extend it:

1. **Stock reservation** happens via a Firestore transaction run from the
   *authenticated customer's own client*, not a server function — see
   `placeOrder()` in `src/lib/firestore/orders.ts`. Security rules narrowly
   allow a signed-in user to increment `stockReserved` (never `stockOnHand`
   or `priceMinor`) on a variant. This is what stops two simultaneous
   purchases from overselling the same unit without needing server code.
2. **Trusted server writes** (crediting a wallet after a verified Paystack
   payment, marking an order paid) go through the dedicated "system" Firebase
   Auth user described in section 3a, not an Admin SDK. See
   `src/lib/firebase/systemAuth.ts` for the full explanation.

If a future phase decides the "no service account" constraint should be
relaxed (e.g. for heavier server-side reporting), swapping in
`firebase-admin` inside `app/api/*` routes only — leaving the client-side
architecture untouched — is a contained change.
