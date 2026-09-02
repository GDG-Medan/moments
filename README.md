# GDG Moments

AI-powered event moments hub for Google Developer Groups communities.

Members join an event room with a QR code, upload photos or videos, apply chapter twibbon branding, earn community points from peer ratings, and get Gemini-generated captions ready to share. Organizers curate AI-suggested highlights for Instagram, Facebook, or TikTok using download + copy caption export.

## Features

- QR join / create event rooms
- Photo and video uploads
- Client-side compression and filter presets
- Twibbon overlay for branded exports
- Gemini captions and hashtags
- Peer ratings and points
- Organizer highlight board with Gemini suggestions
- Share via Web Share API, image download, and caption copy

## Tech stack

- Vite + React + TypeScript
- Firebase Authentication (anonymous)
- Cloud Firestore
- Cloud Storage
- Cloud Functions
- Gemini API
- Firebase Hosting

## Setup

### 1. Firebase project

1. Create a Firebase project (example id: `gdg-moments`).
2. Enable **Anonymous** sign-in under Authentication.
3. Create a Firestore database.
4. Enable Storage.
5. Upgrade to Blaze to deploy Cloud Functions that call Gemini.
6. Register a Web app and copy the config values.

### 2. Web app env

```bash
cp .env.example .env
```

Fill:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_FUNCTIONS_REGION=us-central1
```

### 3. Install and run locally

```bash
npm install
cd functions && npm install && cd ..
npm run dev
```

### 4. Gemini via Vertex AI

Cloud Functions call Gemini through **Vertex AI** using the project service account (Blaze billing). No client-side API key is required.

Enable if needed:

```bash
gcloud services enable aiplatform.googleapis.com --project=gdg-moments
```

### 5. Deploy rules, functions, and hosting

```bash
npm run build
firebase deploy
```

Update `.firebaserc` if your project id differs.

## Demo script (90 seconds)

1. Create an event room from the home page.
2. Show the QR / join link on a second device or browser profile.
3. Upload a photo with twibbon + filter.
4. Generate a Gemini caption and copy/share it.
5. Rate a moment from another profile and watch points update.
6. Open **Highlights**, run Gemini suggestions, mark a highlight.

## Points

| Action | Points |
| --- | --- |
| Upload a moment | +5 |
| Receive a new rating | +2 |
| Selected as highlight | +10 |

## Project layout

- `src/` — web client
- `functions/` — callable Gemini functions
- `public/twibbon/` — default GDG twibbon asset
- `firestore.rules` / `storage.rules` — security rules

## License

Apache-2.0 for community reuse by GDG chapters.
