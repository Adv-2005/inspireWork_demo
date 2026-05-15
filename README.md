# Plivo IVR Demo

A multi-level IVR demo with OTP authentication, built with Node.js, Express, and the Plivo Voice API.

---

## Features

- Trigger outbound calls via REST API
- SMS OTP delivery — caller receives the OTP via text before the call connects
- OTP Authentication — caller must enter a 4-digit code (DDMM birthdate) before accessing the IVR
- Wrong OTP → re-prompted until correct
- OTP Retries Lockout- After 3 wrong OTPs call gets disconnected.
- Level 1 IVR: Language selection (English / Spanish)
- Level 2 IVR: Play audio message or connect to a live associate
- Graceful invalid input handling with menu repeat
- Console logging for all call events
- SMS Summary delivery - caller recieves the Summary via text after call gets completed

---

## Project Structure

```
plivo-ivr-demo/
 ├── server.js        # All routes and IVR logic
 ├── package.json
 ├── .env             # Your credentials (never commit this)
 ├── .env.example     # Safe template to commit
 ├── .gitignore
 └── README.md
```

---
## Live Call Status (Demo UI)


## Prerequisites

- Node.js v16+
- A [Plivo account](https://console.plivo.com/) with Auth ID, Auth Token, and a phone number
- [ngrok](https://ngrok.com/) (free tier works)

---

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/Adv-2005/inspireWork_demo
cd inspireWork_demo
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
PLIVO_AUTH_ID=your_plivo_auth_id
PLIVO_AUTH_TOKEN=your_plivo_auth_token
PLIVO_PHONE_NUMBER=your_plivo_phone_number
ASSOCIATE_NUMBER=nummber_you_are_calling_to
BASE_URL=https://your-ngrok-url.ngrok-free.app
PORT=3000
```

### 4. Set your OTP

Open `server.js` and update line 20:

```js
//Hard-coded for now. For production/scalable implementation we can have the databases of our customers with their birthdate
const CORRECT_OTP = "1503";  // Change to your birthdate in DDMM format
```

Example: If your birthday is July 22 → `"2207"`


---

## Running Locally and test

### Start the server

```bash
node server.js
```

### Expose localhost with ngrok

In a separate terminal:

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g. `https://abcd-1234.ngrok-free.app`) - paste into `.env` as `BASE_URL` - restart server.

---

## Triggering a Call

```bash
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"to": "+918031274121"}'
```

---

## Full IVR Flow

```
POST /call triggered
│
▼
SMS sent to caller → "Your code is XXXX"
│
▼
Outbound Call Initiated
        │
        ▼
┌──────────────────────────────────────┐
│  OTP Authentication                   │
│  "Enter your 4-digit code"            │
│  Wrong → re-prompted                  │
│  Correct → proceed                    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Level 1: Language Selection          │
│  Press 1 → English                    │
│  Press 2 → Spanish                    │
└────────┬─────────────────┬───────────┘
         │                 │
         ▼                 ▼
    English             Spanish
         │                 │
         ▼                 ▼
┌──────────────────────────────────────┐
│  Level 2: Options Menu                │
│  Press 1 → Play audio message         │
│  Press 2 → Connect to associate       │
└──────────────────────────────────────┘
│
▼
SMS sent to caller → Summary of the call
```

Invalid input at any level replays the current prompt.

---

## API Endpoints

| Method | Endpoint                | Description                        |
|--------|-------------------------|------------------------------------|
| POST   | `/call`                 | Triggers an outbound call          |
| POST   | `/ivr/otp`              | OTP prompt (Plivo webhook)         |
| POST   | `/ivr/otp/verify`       | OTP validation (Plivo webhook)     |
| POST   | `/ivr/language`         | Level 1 — Language prompt          |
| POST   | `/ivr/language/route`   | Routes based on language digit     |
| POST   | `/ivr/menu/english`     | Level 2 — English options          |
| POST   | `/ivr/menu/spanish`     | Level 2 — Spanish options          |
| POST   | `/ivr/action/english`   | Handles English digit              |
| POST   | `/ivr/action/spanish`   | Handles Spanish digit              |

> All `/ivr/*` endpoints are Plivo webhooks — called automatically during the call, not by users directly.

---

## Assumptions & Tradeoffs

- **No database**: OTP is hardcoded; call state flows via Plivo webhook redirects — no session storage needed.
- **Single file**: all logic in `server.js` for demo simplicity.
- **OTP retry**: infinite retries by design (as per requirements — re-prompt until correct).
- **Audio file**: uses a publicly hosted sample MP3. Replace the URL in `server.js` to use your own.
- **Associate number**: forwarded using Plivo `Dial`. If the associate doesn't answer, the call ends.
- **ngrok required**: Plivo webhooks need a public HTTPS URL.

---


If you accidentally committed credentials:
1. Rotate your Plivo Auth Token immediately in the [Plivo Console](https://console.plivo.com/)
2. Remove from git history using `git filter-repo` or BFG Repo Cleaner

---

## What Makes This Demo Stand Out

- The OTP is delivered via **SMS before the call connects** — combining Plivo's SMS and Voice APIs in a single workflow. This mirrors real-world authentication patterns (banking, 2FA) and demonstrates multi-channel orchestration rather than a voice-only integration.

- After the call ends, send the caller an SMS summarising what they did.

- After 3 incorrect OTPs, call gets disconnected.
