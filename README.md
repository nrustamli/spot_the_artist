# Spot the Artist

A Pokémon GO-style web app for discovering street art by Anna Laurini. Photograph her iconic "Face" artworks around the city, verify them with AI, and compete with other collectors.

## Features

- **AI Verification** — CLIP-powered image recognition compares your photo against ~48 reference artworks
- **Camera & Upload** — Capture directly from camera (front/back toggle) or drag-and-drop photos (including HEIC)
- **Personal Gallery** — Save verified finds to your collection with location and notes
- **Public Feed** — Browse all verified discoveries from the community
- **Leaderboard** — Compete by number of verified spots
- **Rewards** — Unlock milestones (10 verified spots → Postcard from the Artist)
- **Mobile-First** — Designed for on-the-go use

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Backend | FastAPI (Python 3.10) |
| Auth | Firebase Authentication |
| Database | Cloud Firestore |
| AI | OpenAI CLIP (`clip-vit-base-patch32`) |
| Deployment | Google Cloud Run via Cloud Build |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (React SPA)                                │
│  - Firebase SDK handles sign-in                     │
│  - Sends Bearer token on protected API calls        │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────┐
│  FastAPI (Cloud Run)                                │
│  - Serves React build as SPA                        │
│  - Verifies Firebase ID tokens (firebase-admin)     │
│  - CLIP verification against reference images       │
│  - Gallery CRUD → Cloud Firestore                   │
└─────────────────────────────────────────────────────┘
```

**Verification flow:**
1. User uploads/captures image
2. Backend embeds image via CLIP and computes cosine similarity against all reference images
3. Average of top-k similarities is scaled to 0–100% confidence
4. ≥ 80% confidence → verified; image can be saved to gallery

**Image storage:** Compressed to 800px / JPEG 70% quality, stored as base64 in Firestore documents.

## Project Structure

```
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
```

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.10+
- A Firebase project with Firestore enabled
- A Firebase service account key (JSON)

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Set credentials (choose one)
export FIREBASE_SERVICE_ACCOUNT_JSON='{ ...json content... }'
# or
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Create .env.local with your Firebase web config
cp .env.example .env.local  # then fill in values

npm install
npm run dev
# → http://localhost:5173 (proxies /api to localhost:8000)
```

**Required frontend env vars:**
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/api/health` | — | Health check |
| `POST` | `/api/verify` | — | Verify image (multipart/form-data) |
| `GET` | `/api/auth/me` | ✓ | Get user profile + stats |
| `GET` | `/api/gallery` | — | List gallery (paginated, filterable by user) |
| `POST` | `/api/gallery` | ✓ | Save image to gallery |
| `GET` | `/api/gallery/{id}` | — | Get single gallery item |
| `DELETE` | `/api/gallery/{id}` | ✓ | Delete own gallery item |
| `GET` | `/api/leaderboard` | — | Top users by arts spotted |
| `GET` | `/api/gallery/stats` | — | Aggregate stats |

## Deployment

The app deploys automatically to Google Cloud Run on push to `main`.

**Required GitHub secrets:**
- `GCP_WORKLOAD_IDENTITY_PROVIDER` + `GCP_SERVICE_ACCOUNT` — GCP auth via workload identity federation
- `VITE_FIREBASE_*` — Firebase web config (injected as Docker build args)

**Cloud Run config:** 2 vCPU, 4 GiB RAM, 1 max instance, `europe-west1`. The Firebase service account is injected at runtime via GCP Secret Manager as `FIREBASE_SERVICE_ACCOUNT_JSON`.

The Docker image is large (~5–8 GB) due to PyTorch + CLIP. First cold start may be slow.

## Firestore Collections

| Collection | Key fields |
|---|---|
| `users/{uid}` | `username`, `email`, `arts_spotted`, `verified_spots`, `created_at` |
| `gallery/{docId}` | `user_id`, `image_data` (base64), `is_verified`, `confidence`, `location`, `notes`, `created_at` |

## License

MIT
