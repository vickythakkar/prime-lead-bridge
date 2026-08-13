# Prime Lead Bridge - Project Handoff & Architecture Document

This document provides a complete technical overview of the Prime Lead Bridge project. Use this document to instantly catch up a new AI agent on the exact state of the codebase, the business requirements, and the external integrations (Twilio, Supabase, Vercel).

## 1. Project Overview & Architecture
Prime Lead Bridge is a multi-tenant SaaS application designed to provide virtual phone numbers, IVR (Interactive Voice Response), and SMS capabilities to real estate brokerages. 
- **Framework:** Next.js 14+ (App Router)
- **Database & Auth:** Supabase
- **Communications:** Twilio (Voice SDK for Web Dialer, TwiML for IVR, SMS API)
- **Email Notifications:** Resend
- **Hosting:** Vercel

## 2. Core Business Requirements & Roles

The system is strictly divided into two roles. **They must be treated as completely separate environments.**

### A. The Admin (`info@primerealops.com`)
- **Role:** The platform owner (Master Admin).
- **Abilities:** Can view all organizations, track total usage, generate billing/invoices, assign phone numbers, and has access to a master dialer and messages interface for their own calling and messaging.
- **Auth Implementation:** Does NOT use Supabase Auth. Uses a custom JWT solution via `app/api/admin/auth/login/route.js`. The token is stored in `localStorage('admin_token')`. Need to use auth if it is better so the platform recognizes and routes them accordingly.
- **Primary Routes:** `/admin/dashboard`, `/admin/dialer`, `/admin/messages`
- **Login:** Handled via the unified `/login` page which intercepts `info@primerealops.com` and routes to the custom admin auth endpoint.

### B. The Broker / Tenant (`vicky@diyflatfee.com`)
- **Role:** A tenant organization using the platform.
- **Abilities:** Can make and receive calls from their browser via Twilio Web SDK, send/receive SMS messages, view call logs, and manage their contacts.
- **Auth Implementation:** Uses standard Supabase Auth (`supabase.auth.signInWithPassword`).
- **Primary Routes:** `/dashboard`, `/dashboard/dialer`, `/dashboard/messages`, `/dashboard/calls`
- **Login:** Handled via the unified `/login` page which routes to Supabase Auth.

## 3. External Configurations (Twilio)

For the platform to function, Twilio must be strictly configured to point to the live Vercel URL.

- **Master Twilio Number:** `+19298338186`
- **TwiML App (For Web Dialer):** 
  - Voice Request URL: `https://prime-lead-bridge-five.vercel.app/api/twilio/voice`
- **Phone Number Webhooks:**
  - Voice (A call comes in): `https://prime-lead-bridge-five.vercel.app/api/ivr/incoming`
  - Messaging (A message comes in): `https://prime-lead-bridge-five.vercel.app/api/sms/webhook`

## 4. Key Files & Folders to Know

### Frontend (UI & Web Dialer)
- **`app/login/page.js`:** The unified login page. Contains the logic that splits Admin vs Broker authentication.
- **`app/dashboard/dialer/page.js`:** The Broker Web Dialer. Uses `@twilio/voice-sdk` to instantiate a `Device`.
- **`app/admin/dialer/page.js`:** The Admin Web Dialer.
- **`app/dashboard/messages/page.js`:** SMS conversation UI.
- **`app/dashboard/components/Sidebar.js`:** Broker navigation (includes the working Logout button).

### Backend (Twilio Webhooks & APIs)
- **`app/api/twilio/token/route.js`:** Generates Twilio Access Tokens for the Web Dialer. Authenticates BOTH Admins (via JWT) and Brokers (via Supabase).
- **`app/api/twilio/voice/route.js`:** The TwiML Voice Request webhook. Handles outbound calls initiated from the Web Dialer.
- **`app/api/ivr/incoming/route.js`:** Handles incoming calls to the Twilio number. Plays the "Welcome to Prime Real Ops" greeting and triggers the menu.
- **`app/api/calls/status/route.js`:** Logs call duration, statuses, and recording URLs to the Supabase `call_logs` table.
- **`app/api/sms/webhook/route.js`:** Handles incoming SMS messages, logs them to Supabase, and triggers a Resend email notification.
- **`app/api/sms/send/route.js`:** Sends outbound SMS messages using the Twilio Node REST API.

## 5. Recently Resolved Critical Bugs (Context for new AI)

If a new agent takes over, they need to know these bugs were *already solved* so they don't break them again:

1. **Twilio Dialer Stuck on "Initializing":** 
   - *Issue:* The `await device.register()` call was blocking the UI because modern browsers halt JavaScript execution to ask for microphone permissions.
   - *Fix:* Removed the `await` on `register()`. Outbound calls (`device.connect`) do not strictly require registration to be awaited. 
2. **Twilio Error 13214 (Invalid Caller ID):** 
   - *Issue:* When the frontend sent the `callerId` (e.g. `+19298338186`) over the network, it was URL-encoded to `%2B19298338186`. The backend passed `%2B` straight to Twilio `<Dial>`, which Twilio rejected.
   - *Fix:* Implemented `decodeURIComponent()` in `app/api/twilio/voice/route.js` to restore the `+` sign.
3. **Admin 404 & 2 URLs:**
   - *Issue:* Separate `/admin` and `/login` pages caused friction and caching issues.
   - *Fix:* Merged into a single `/login` page that checks the email string. If it matches the master admin email, it uses the admin JWT API; otherwise, it hits Supabase.
4. **Logout Buttons Not Working:**
   - *Fix:* Implemented `supabase.auth.signOut()` and `localStorage.removeItem('admin_token')` respectively.
