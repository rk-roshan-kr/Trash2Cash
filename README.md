# Trash2Cash (Multi-page Demo)

A simple multi-page Trash2Cash demo using the Firebase Web SDK (Firestore) and Leaflet.

## Pages
- `index.html` — login with demo credentials; sets session and routes to role pages
- `user.html` — create listings, view wallet, and see trucks on the map
- `govt.html` — collect items by Ref ID; updates status/timeline
- `company.html` — view lots and place bids

## Local Development
1. Start a local server (already used in this project):
   - `python -m http.server 8000`
2. Open the app:
   - `http://localhost:8000/index.html?rt=poll`
   - Use `rt=poll` if realtime streams are blocked; hybrid mode is default.

## Firebase
- Config is defined in `common.js` and uses Firestore with long-polling settings.
- For strict CSP, we include a dev CSP meta tag on each page. Adjust for production.

## Demo Credentials
- User: `user1` / Govt: `gov1` / Company: `co1` (IDs only; no auth) — session is tracked via `sessionStorage` from `index.html`.

## Notes
- This repo is meant for demo/testing. Harden Firestore rules and add Auth for production.
- Inline scripts can be externalized and CSP restricted further for production.