# MedMind — Smart Medication Adherence PWA

A Next.js 16 (App Router) + Supabase medication-adherence Progressive Web App with AI assistance, voice control, caregiver portal, and offline support.

---

## Environment Variables

Add these to `.env.local`:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (for full features) | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (for full features) | Your Supabase anon/public key |
| `GEMINI_API_KEY` | Yes (for AI/voice) | Google Gemini API key — get one at [aistudio.google.com](https://aistudio.google.com/apikey) |
| `CRON_SECRET` | Optional | Random string to protect the `/api/cron/check-missed-doses` route |

**Without Supabase:** The app runs in local `db.json` fallback mode. The dashboard and puzzle-lock work fully. Auth-dependent features (caregiver, doctor, connections) show a banner instead of crashing.

---

## Database Setup

1. **Initial setup** — Run `supabase_setup.sql` in your Supabase SQL editor (creates all tables with open dev policies).

2. **Auth migration** — Run `supabase_migration_001.sql` in your Supabase SQL editor. This:
   - Adds `user_id`, `role`, `phone` columns to `profiles`
   - Creates `caregiver_patient`, `doctor_patient`, `notifications` tables
   - Replaces open dev RLS policies with auth-scoped ones
   - Creates a `get_profile_by_email(p_email TEXT)` RPC function for the connect-patient flow

   > **Note:** The migration deletes any unlinked profile rows (old seed data with no auth user). All users must sign up fresh after running this migration.

3. **Add the RPC function** — Also run this in the SQL editor:
   ```sql
   CREATE OR REPLACE FUNCTION public.get_profile_by_email(p_email TEXT)
   RETURNS TABLE(id UUID, name TEXT, role TEXT, phone TEXT)
   LANGUAGE sql SECURITY DEFINER
   AS $$
     SELECT p.id, p.name, p.role, p.phone
     FROM public.profiles p
     INNER JOIN auth.users u ON u.id = p.user_id
     WHERE u.email = p_email
     LIMIT 1;
   $$;
   ```

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login` to sign up.

---

## Features — Real vs. Still Mocked

### ✅ Real (fully implemented)

| Feature | Details |
|---|---|
| **Auth** | Email/password via Supabase Auth, role selector (Patient/Caregiver/Doctor) |
| **Dashboard** | Real medications, adherence %, streak — scoped to logged-in user |
| **Puzzle Lock** | Real dose logging via math puzzle gate |
| **Caregiver Portal** | Real patient data, live missed-dose detection, connect-by-email flow, call/WhatsApp links |
| **Doctor Report** | Real Recharts bar chart from `dose_logs`, per-medication scores, PDF export |
| **AI Assistant** | Real Gemini API calls grounded in patient's medication list |
| **Voice Control** | Real Web Speech API transcription → fuzzy match → Gemini fallback → logs real doses |
| **Offline Mode** | PWA manifest, service worker caching, IndexedDB queue, auto-replay on reconnect |
| **Missed Dose Cron** | `/api/cron/check-missed-doses` — creates caregiver notifications |
| **Notifications** | In-app notification polling in caregiver portal (30s interval) |

### ⏳ Stubbed / Deferred

| Feature | Status |
|---|---|
| Twilio SMS alerts | TODO comment in cron route — requires paid Twilio account |
| Push notifications | Not implemented — would need VAPID keys and notification permission |
| Profile edit page | Phone number must be set directly in Supabase dashboard for now |
| Medication add/edit | Fixed default medication set on signup — no UI to add custom meds yet |
| WebSocket real-time | Caregiver portal polls every 30s instead of real-time push |

---

## Deployment (Vercel)

1. Add all env vars in Vercel project settings
2. `vercel.json` is included with a cron schedule running missed-dose detection every 15 minutes
3. The service worker requires HTTPS — works out of the box on Vercel

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **AI:** Google Gemini (`@google/generative-ai`)
- **Charts:** Recharts
- **PDF:** jsPDF + html2canvas
- **Offline:** IndexedDB via `idb`, Service Worker
- **Styling:** Vanilla CSS (dark/neon theme)
