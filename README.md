# AI Call BD — Bulk Voice Campaign Platform

A full-stack platform for launching bulk voice campaigns to Bangladeshi mobile numbers using the **IPCall BD Voice API**. Includes real-time call status tracking, wallet-based billing, call recordings, and an admin dashboard.

---

## 🔗 Repositories

| Layer | Repository |
|---|---|
| Frontend (Next.js) | https://github.com/infoitsolver24/ai-call-bd-frontend |
| Backend (Node.js) | https://github.com/infoitsolver24/ai-call-bd-backend |

---

## ✨ Features

- 📞 **Bulk Voice Campaigns** — Upload audio once, call hundreds of BD numbers
- 🎙️ **Voice File Management** — Upload via file or public URL
- ⚡ **Real-time Call Status** — `Queued → Ringing → Answered / Busy / Failed`
- 🎧 **Call Recordings** — Auto-fetched from IPCall after each call
- 💰 **Wallet & Billing** — Per-minute billing with pre-launch balance check
- 📊 **Live Dashboard** — Summary metrics (Total / Success / Failed / Active)
- 🔐 **JWT Auth** — Company-scoped access with admin/super-admin roles
- 🔄 **Auto Sync & Reaper** — Stuck calls auto-marked failed after 15 min
- 📱 **Responsive UI** — Built with Tailwind CSS

---

## 🏗️ Tech Stack

### Backend
- **Runtime:** Node.js `v24.19.0`
- **Framework:** Express.js
- **Database:** MySQL 8
- **Auth:** JWT
- **HTTP Client:** Axios
- **Upload:** Multer

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Notifications:** Sonner


## 📁 Project Structure

### Backend

```
ai-call-bd-backend/
├── src/
│   ├── config/
│   │   ├── db.js                # MySQL connection pool
│   │   └── multer.js            # Audio upload config
│   ├── middleware/
│   │   ├── auth.js              # JWT verification
│   │   ├── upload.js            # Multer wrapper
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── campaignRoutes.js
│   │   ├── webhookRoutes.js
│   │   ├── voiceFileRoutes.js
│   │   └── index.js
│   ├── controllers/
│   │   ├── campaignController.js
│   │   ├── voiceFileController.js
│   │   └── authController.js
│   ├── services/
│   │   ├── campaignService.js       # IPCall launch + webhook
│   │   ├── ipcallSyncService.js     # Background log sync + reaper
│   │   ├── settingsService.js
│   │   └── walletService.js
│   ├── utils/
│   │   ├── numberParser.js
│   │   └── asyncHandler.js
│   └── app.js
├── database/
│   └── schema.sql
├── uploads/
│   └── audio/                   # Uploaded voice files
├── .env.example
├── .gitignore
├── ecosystem.config.js          # PM2 config
├── package.json
└── server.js
```

### Frontend

```
ai-call-bd-frontend/
├── app/
│   ├── admin/
│   │   ├── campaigns/
│   │   │   ├── create/page.tsx   # Create campaign page
│   │   │   └── page.tsx          # Campaign list
│   │   └── dashboard/
│   ├── lib/
│   │   └── authToken.ts
│   └── layout.tsx
├── components/
├── public/
├── .env.local.example
├── next.config.js
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 🚀 Local Development

### Prerequisites

- **Node.js:** `v24.19.0` — verify with `node --version`
- **npm:** `v10+`
- **MySQL:** `v8.0+`
- **Git**

### 1. Clone Both Repositories

```bash
git clone https://github.com/infoitsolver24/ai-call-bd-backend.git
git clone https://github.com/infoitsolver24/ai-call-bd-frontend.git
```

### 2. Backend Setup

```bash
cd ai-call-bd-backend
npm install
npm run dev
Backend will start on **http://localhost:5000**

### 3. Frontend Setup

```bash
cd ../ai-call-bd-frontend
npm install
npm run dev
Frontend will start on **http://localhost:3000**
```

## 🔑 Initial Configuration

After both servers are running:

1. **Register a company account** via `/register`
2. **Login as super admin** (seed account or promote via DB):

3. Navigate to **Admin → Settings** and set the **IPCall BD API Key**
   - Get it from https://ipcall.bd → Developers → API Key

4. Set **delay seconds** and **max batch size** for dispatch throttling

5. Top up the **wallet** for the company (or disable balance check in dev)

---

## 🔌 IPCall BD Integration

The backend integrates four IPCall endpoints:

| Action | Endpoint | Method |
|---|---|---|
| Register voice file | `/voiceapi/uploadvoice/` | GET |
| Trigger call | `/voiceapi/newrequest/` | GET |
| Fetch call logs | `/voiceapi/calllogs/` | GET |
| Incoming webhook | `/api/webhooks/voice-status` | POST |

### Webhook Flow

```
Campaign launched
       ↓
POST /campaigns/launch → dispatchIpcallRequests()
       ↓
IPCall /newrequest/ per number → status = 'ringing'
       ↓
IPCall POST /api/webhooks/voice-status
       ↓
handleVoiceWebhook() → status = 'completed' | 'busy' | 'failed' ...
       ↓
backfillCallDetails() → fetch duration + recording from /calllogs/
       ↓
Frontend polls /campaigns/live-logs every 30s → UI updates
```

### Webhook Payload (from IPCall)

```json
{
  "id": "782394",
  "status_code": "1",
  "status": "Answered",
  "DTMF": "1",
  "data": "camp_5_num_23"
}
```

The `data` field is set to `camp_<campaignId>_num_<numberRowId>` at dispatch time so webhook matching is deterministic.

---

## 📡 API Reference (Backend)

All routes require JWT auth unless noted.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/campaigns/launch` | Launch bulk campaign |
| `GET` | `/campaigns/live-logs` | Real-time status + summary |
| `GET` | `/campaigns/history` | Paginated call history |
| `GET` | `/campaigns` | List all campaigns |
| `GET` | `/campaigns/:id` | Campaign detail + numbers |
| `PATCH` | `/campaigns/:id/status` | Pause / resume / cancel |
| `DELETE` | `/campaigns/:id` | Delete campaign |
| `GET` | `/campaigns/stats` | Dashboard stats |
| `POST` | `/voice-files/register-url` | Register voice from public URL |
| `POST` | `/api/webhooks/voice-status` | **IPCall webhook (public)** |

---


## 🌍 Deployment (cPanel + Node.js)


### Prerequisites

- cPanel hosting with **Setup Node.js App** (Node.js 20+ selectable)
- SSH / cPanel Terminal access
- MySQL database (created in cPanel)
- Two domains (recommended):
  - `api.aicallbd.com` → backend (sub domain) 
  - `aicallbd.com` → frontend


---

### 📦 Step 1 — Create MySQL Database

1. cPanel → **MySQL® Databases**
2. Create database: `username_ai_call_bd`
3. Create user: `username_dbuser` with a strong password
4. Add user to database with **ALL PRIVILEGES**

Import the schema:

```bash
mysql -u username_dbuser -p username_ai_call_bd < database/schema.sql
```
Or use **phpMyAdmin → Import** in cPanel.

---

### 📤 Step 2 — Upload Backend Files

**Do NOT upload `node_modules/` or `.env`** — those are created on the server.


####  File Manager / FTP

1. Zip your local backend (exclude `node_modules`, `.env`, `.git`)
2. Upload to `/home/USERNAME/ai-call-bd-backend/`
3. Extract via File Manager

---

### ⚙️ Step 3 — Create Node.js App (Backend)

1. cPanel → **Software → Setup Node.js App**
2. Click **Create Application**
3. Fill:

   | Field | Value |
   |---|---|
   | Node.js version | **20.x** or newer |
   | Application mode | **Production** |
   | Application root | `ai-call-bd-backend` |
   | Application URL | `api.yourdomain.com` |
   | Application startup file | `server.js` |

4. Click **Create**

---

### 🔑 Step 4 — Set Environment Variables

In the same Node.js App screen, scroll to **Environment Variables** and add:


> ⚠️ `BASE_URL` **must be public HTTPS** — IPCall posts call-status webhooks to `${BASE_URL}/api/webhooks/voice-status`.

> ⚠️ cPanel MySQL username/password always include the cPanel prefix. Use them exactly as shown in MySQL Databases page.

---

### 📥 Step 5 — Install Dependencies & Start

Open **cPanel Terminal** or SSH:

```bash
# Paste the command from Step 3 (it looks like this):
source /home/USERNAME/nodevenv/ai-call-bd-backend/20/bin/activate && cd /home/USERNAME/ai-call-bd-backend

# Install production deps
npm install --production
```

Then in **Setup Node.js App → your app**, click **Restart**.

Verify the backend responds:

```bash
curl http://127.0.0.1:5000/api/webhooks/voice-status
# → {"received":true,"handled":false,"reason":"no_match"}
```

If you see "Cannot GET /" — that's fine, means the server is up.



### 🎨 Step 6 — Deploy Frontend (Next.js)


#### Option A — Full Next.js Node.js App (SSR, recommended)

1. Upload frontend source to `/home/USERNAME/ai-call-bd-frontend/` (exclude `node_modules`, `.next`, `.env.local`)

2. cPanel → **Setup Node.js App → Create Application**:

   | Field | Value |
   |---|---|
   | Node.js version | 20.x |
   | Application mode | Production |
   | Application root | `ai-call-bd-frontend` |
   | Application URL | `app.yourdomain.com` |
   | Application startup file | `node_modules/next/dist/bin/next` |
   | Application startup script | `start` |


3. Add environment variable in the Node.js App UI:

   ```env
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   NODE_ENV=production
   ```

4. Enter the virtualenv and build:

   ```bash
   source /home/USERNAME/nodevenv/ai-call-bd-frontend/20/bin/activate && cd /home/USERNAME/ai-call-bd-frontend
   npm install
   npm run build
   ```

5. Restart the Node.js app from cPanel.


### 🔒 Step 7 — Enable SSL (AutoSSL)

1. cPanel → **SSL/TLS Status**
23. Wait ~5 minutes
3. Verify:

   ```bash
   curl -I https://api.yourdomain.com
   curl -I https://app.yourdomain.com
   ```
> 🔐 IPCall refuses HTTP webhooks. **HTTPS is mandatory.**

---

### 🔗 Step 8— Verify Webhook Reachability

```bash
curl https://api.yourdomain.com/api/webhooks/voice-status
```

Expected:

```json
{"received":true,"handled":false,"reason":"no_match"}
```

If this fails:

| Symptom | Cause | Fix |
|---|---|---|
| `404` | Route not registered | Check `webhookRoutes.js` mounted at `/api/webhooks` |
| `502 Bad Gateway` | Node app not running | cPanel → Setup Node.js App → Restart |
| `503 Service Unavailable` | Passenger not proxying | Check app status is "Running" |
| `ERR_CONNECTION_REFUSED` | SSL not enabled | Run AutoSSL |

---

### 🔄 Step 9 — Updating After Code Changes

Because cPanel Node.js apps don't auto-deploy, use one of these:


### Requirements

- MySQL 8
- Node.js v24



## 🐛 Troubleshooting

| Problem | Solution |
|---|---|
| Webhook not received | Check `BASE_URL` is public (use ngrok for local) |
| Call stuck in "Queued" | Verify `dispatchIpcallRequests` completed and webhook reaches backend |
| Duration shows `0:00` | `backfillCallDetails` couldn't find call in `/calllogs/` — check API key |
| Campaign stuck in "processing" | Reaper runs every sync; check `syncRecentCalls()` in logs |
| `ER_ACCESS_DENIED` | MySQL credentials in `.env` are wrong |
| `IPCall API key not configured` | Set it in Admin → Settings |

---
