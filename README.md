## 🎨 Spot the Artist
Street art is everywhere, but there's no fun way to **collect** it. Spot the Artist turns city walks into a game:

- **Discover** - Find street artworks by artist hidden around the city
- **Verify** - Snap a photo and let AI confirm it's a real piece (not a random wall)
- **Collect** - Build a personal gallery of verified finds with locations and notes

No app install required — it's a mobile-first web app that works from any browser.

## Features

+ **AI Verification:**  CLIP-powered image recognition compares your photo against ~48 reference artworks 
+ **Camera & Upload:**  Capture directly from camera (front/back toggle) or drag-and-drop photos (including HEIC) 
+ **Personal Gallery:** Save verified finds to your collection with location and notes 
+ **Public Feed:**  Browse all verified discoveries from the community 
+ **Leaderboard:**  Compete by number of verified spots 
+ **Rewards:**  Unlock milestones (e.g. collect 10 verified spots gain a postcard from the artist) 
+ **Mobile-First:** Designed for on-the-go street art hunting 


## How It Works

┌─────────────────────────────────────────────────────┐
│  Browser (React SPA)                                │
│  Firebase SDK handles sign-in                       │
│  Sends Bearer token on protected API calls          │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────┐
│  FastAPI (Cloud Run)                                │
│  Verifies Firebase ID tokens (firebase-admin)       │
│  CLIP verification against reference images         │
│  Gallery CRUD → Cloud Firestore                     │
└─────────────────────────────────────────────────────┘

**Verification flow:**

1. User uploads or captures a photo
2. Backend embeds the image via CLIP and computes cosine similarity against all reference images
3. Average of top-k similarities is scaled to a 0–100% confidence score
4. If the score is ≥ 80% confidence then the image is verified and can be saved to the gallery

**Image storage:** Compressed to 800px / JPEG 70% quality, stored as base64 in Firestore documents.

## Tech Stack
+ Frontend: React 19 
+ Backend: FastAPI (Python 3.10) 
+ Auth: Firebase Authentication 
+ Database: Cloud Firestore 
+ AI: OpenAI CLIP (`clip-vit-base-patch32`) 
+ Deployment: Google Cloud Run via Cloud Build 

## Project Structure

spot_the_artist/
├── frontend/
│   └── src/
│       ├── App.jsx                  # Main state machine (page, mode, status)
│       ├── firebase.js              # Firebase SDK config
│       ├── contexts/
│       │   └── AuthContext.jsx      # Auth state + API helpers
│       └── components/
│           ├── CameraCapture.jsx    # getUserMedia, front/back toggle
│           ├── FileUpload.jsx       # Drag-drop, HEIC → JPEG conversion
│           ├── Gallery.jsx          # Paginated grid, delete
│           ├── VerificationResult.jsx
│           ├── MyRewards.jsx
│           └── ...
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI routes + SPA serving
│   │   ├── auth.py                  # Token verification, user CRUD (Firestore)
│   │   ├── database.py              # Firestore client
│   │   ├── gallery_service.py       # Gallery CRUD + reward milestones
│   │   └── clip_service.py          # CLIP model + verification pipeline
│   ├── reference_art/               # ~48 reference images
│   └── requirements.txt
├── Dockerfile                       # Multi-stage: Node build → Python runtime
├── cloudbuild.yaml                  # GCP Cloud Build config
└── .github/workflows/
    └── deploy-cloud-run.yml         # CI/CD: push to main → deploy

## Deployment

The app deploys automatically to **Google Cloud Run** on every push to `main`.

## Firestore Collections
+ Collection: `users/{uid}` | Key Fields: `username`, `email`, `arts_spotted`, `verified_spots`, `created_at` 
+ Collection: `gallery/{docId}` | Key Fields: `user_id`, `image_data` (base64), `is_verified`, `confidence`, `location`, `notes`, `created_at` 

## License

MIT
