# Intercom Resident App

React + Vite + Capacitor. Verified in the sandbox this was built in: `npm install`
completes cleanly, and `npm run build` produces a working production bundle
with zero TypeScript errors (39 modules, ~157KB gzipped to ~51KB).

## Setup

```bash
npm install
cp .env.example .env   # point VITE_API_URL at your running backend
npm run dev             # runs at http://localhost:5173, talks to the backend directly
```

Try the full login flow with a resident's real invite code from the backend
(create one via the dashboard/API first — see the backend README). Outside
production, `POST /resident-auth/request-otp` returns the OTP directly in
the response so you can test the whole flow without real SMS/email delivery
— you'll see it displayed on the login screen itself in dev mode.

## What's built and working end-to-end

- **Login**: invite code → OTP → JWT, stored via Capacitor's `Preferences`
  API (not `localStorage` — more reliable persistence in a WebView across
  app restarts)
- **Home**: fetches the logged-in resident's real data from `GET /residents/me`

## What's next (stubbed, not built)

- Open Door button — needs the WebRTC signaling + device-command layer
  (flagged as not-yet-built in the backend README)
- Virtual Keys, Entry PIN, Activity Log, Settings — screens are shown as
  disabled placeholders on Home; each needs its own backend wiring (some of
  which already exists — e.g. Virtual Keys' backend endpoints are done, just
  not yet wired to a screen here)
- Push notifications — `@capacitor/push-notifications` is installed as a
  dependency but not yet initialized/wired to APNs/FCM
- Incoming Call / Active Call screens — depend on the signaling layer

## Turning this into a real native app (needs your machine, not this sandbox)

I can't run Xcode or the Android SDK here, so these steps are yours to run:

```bash
npm run build          # produces the web bundle in dist/
npx cap add ios        # first time only
npx cap add android     # first time only
npx cap sync            # copies the web build into the native projects

npm run cap:ios         # opens Xcode
npm run cap:android      # opens Android Studio
```

From there it's a normal native app — run on a simulator/device from Xcode
or Android Studio like any other project.

## Design note

This codebase's `screens/` and eventual `components/` are intended to be
the shared building blocks reused across three surfaces per the project
spec: this resident app, the Android panel (also Capacitor), and the
visitor QR web-calling page (plain web build, no Capacitor). As the panel
and visitor page get built, expect some of what's in `src/` here to move
into a shared package rather than staying resident-app-specific.
