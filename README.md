# Bulk Calling System

Multi-tenant outbound voice-broadcast platform. Two independent billing gates:

1. **Subscription (monthly, paid via bKash)** — unlocks the dashboard at all.
   No active subscription = no access to anything except the billing/subscription
   page. Enforced by `requireActiveSubscription` on every `/api/campaigns/*` and
   `/api/wallet/*` route.
2. **Wallet / call credit (top up any amount, via bKash)** — pays for the actual
   calls. Every completed call deducts `rate_per_minute_bdt × minutes` (rounded
   up) from the company's balance. When balance can't cover one more minute, the
   running campaign auto-pauses with `pause_reason: "insufficient_balance"` so
   the frontend can show a "recharge your balance" notice.

Once both are satisfied: create a campaign → paste/upload phone numbers → upload
a voicemail `.mp3`/`.wav` → click start → numbers get called one by one, and
whoever answers hears the audio.

Built on Node.js + Express + MySQL, with Twilio doing the actual dialing.

## ⚠️ Before you launch this for real

Bulk outbound calling with pre-recorded audio is regulated in most countries
(TCPA in the US, similar telemarketing rules elsewhere, and BTRC regulations in
Bangladesh for automated/robocall traffic). This code includes the technical
hooks — opt-out via "press 9", a do-not-call list that's checked before every
call, per-plan call caps — but **you are responsible for**:
- Only calling numbers you have proper consent/legal basis to call
- Respecting national Do-Not-Call registries
- Disclosing who's calling, per local law
- Rate limits Twilio and local telecoms impose on robocall-style traffic

## Stack
- **Backend**: Node.js, Express
- **Database**: MySQL (schema in `db/schema.sql`)
- **Calling**: Twilio Programmable Voice (with Answering Machine Detection)
- **Billing**: bKash Payment Gateway (Tokenized Checkout) — bKash has no native
  recurring subscription API, so this app simulates one: each successful
  payment activates/renews a 30-day subscription period in our own DB.

## Setup

1. **Database**
   ```bash
   mysql -u root -p < db/schema.sql
   ```
   Already have the database from before? Run the migration instead:
   ```bash
   mysql -u root -p < db/migration_001_wallet.sql
   ```

2. **Environment**
   ```bash
   cp .env.example .env
   # fill in DB creds, JWT_SECRET, Twilio credentials, bKash credentials, BASE_URL
   ```
   `BASE_URL` must be a **publicly reachable HTTPS URL** — both Twilio (to fetch
   TwiML, deliver call-status webhooks, and serve the audio file to play) and
   bKash (to redirect the browser back after checkout) need to reach your server.
   For local development, use a tunnel (ngrok, Cloudflare Tunnel, etc.) and put
   that URL in `BASE_URL`.

3. **Install & run**
   ```bash
   npm install
   npm start        # or `npm run dev` with nodemon
   ```

## How it fits together

### A) Subscription — unlocks the dashboard
1. `POST /api/auth/signup` — creates a company + admin user, returns a JWT.
2. `GET /api/subscriptions/plans` — list plans (Starter/Growth/Business — edit
   prices directly in the `plans` table; note `monthly_call_limit` is legacy and
   no longer enforced now that calls are billed from the wallet instead).
3. `POST /api/subscriptions/subscribe { planId }` — creates a bKash payment,
   returns `bkashURL`; redirect the user's browser there to pay.
4. bKash redirects back to `/api/subscriptions/bkash/callback`, which executes
   the payment and, on success, activates a 30-day subscription.
5. `GET /api/subscriptions/me` — check current subscription status; if
   `current_period_end` has passed, redirect the frontend to the billing page —
   every campaign/wallet API call will return `402` until they renew.

### B) Wallet — pays for calls
6. `GET /api/wallet` — current balance + the per-minute rate they're charged
   (`rate_per_minute_bdt`, set per-company in the `companies` table — default
   2.5 BDT/min, change it to whatever markup you want over Twilio's cost).
7. `POST /api/wallet/topup { amount }` — creates a bKash payment for any amount
   (min 10 BDT), returns `bkashURL` to redirect the user to.
8. bKash redirects back to `/api/wallet/bkash/callback`, which executes the
   payment and credits the wallet on success.
9. `GET /api/wallet/transactions` — full ledger: top-ups (positive) and
   per-call charges (negative), each call charge referencing the
   `campaign_numbers` row it paid for.

### C) Campaigns — actually calling
10. `POST /api/campaigns` — create a campaign.
11. `POST /api/campaigns/:id/numbers` — add numbers either as
    `{ "numbersText": "01711111111\n01722222222" }` JSON, or multipart CSV
    upload (field name `file`).
12. `POST /api/campaigns/:id/audio` — multipart upload (field name `file`),
    `.mp3` or `.wav`, of the voicemail message to play.
13. `POST /api/campaigns/:id/start` — returns `402 INSUFFICIENT_BALANCE` if the
    wallet can't cover at least one more minute. Otherwise starts the dialer,
    which works through the number list with bounded concurrency
    (`MAX_GLOBAL_CONCURRENT_CALLS`) and skips any number on the do-not-call
    list. Mid-campaign, if the wallet balance runs out it auto-pauses with
    `pause_reason: "insufficient_balance"`.
14. `GET /api/campaigns/:id` — poll for live status counts (answered /
    voicemail / no_answer / failed / opted_out / pending), plus current wallet
    balance — use this to drive the "recharge your balance" notification in
    the UI.

All `/api/*` routes except signup/login/plan-list/bkash-callbacks require
`Authorization: Bearer <token>`. All `/api/campaigns/*` and `/api/wallet/*`
routes additionally require an active subscription (`402` otherwise) — that's
what keeps an expired-subscription company locked out of the dashboard.

## Scaling notes
- The dialer in `src/services/dialerQueue.js` is an in-process loop — fine for
  a single server instance and moderate volumes. For real scale (many
  thousands of numbers, multiple app servers), swap it for a proper job queue
  (BullMQ + Redis) — the call-placing and status-tracking logic stays the same.
- Store audio files on S3/Cloud Storage instead of local disk in production, so
  the public URL Twilio fetches doesn't depend on a single server's uptime.
- Add a scheduled job to auto-expire subscriptions (`current_period_end < NOW()`
  → status `expired`) and to prompt renewal.
