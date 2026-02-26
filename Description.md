# Spot the Artist

**An AI-powered street art discovery app — think "Pokemon GO" meets art verification.**

Users explore their city to find street art by artist **Anna Laurini**, snap a photo, and an AI model instantly tells them if it's authentic. Verified discoveries are saved to a public gallery with a leaderboard ranking the top art hunters.

---

## The Problem

Street art is ephemeral and often unsigned. Fans of a specific artist have no easy way to confirm whether a piece they've found is actually by that artist — or to share and catalog their discoveries.

## The Solution

Spot the Artist gives fans a tool to **photograph**, **verify**, and **collect** street art finds. OpenAI's CLIP model compares user photos against a curated reference set of the artist's work, returning a confidence score in seconds. Verified finds are saved to the user's personal gallery and displayed on a public feed.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **AI Art Verification** | CLIP-based zero-shot image similarity — no fine-tuning needed. Compares uploads against ~48 reference images and returns a 0-100% confidence score. |
| **Camera & Upload** | Snap a photo directly in-app or drag-and-drop an existing image. Supports JPEG, PNG, WebP, and HEIC. |
| **User Galleries** | Authenticated users save verified finds to a personal gallery. Each entry stores the image, confidence score, best-matching reference, and optional notes. |
| **Public Feed** | Browse all community discoveries in a paginated gallery with color-coded cards showing verification status. |
| **Leaderboard** | Rankings based on total artworks spotted and verified discoveries. |
| **Reward System** | Gamified progression to keep users engaged as they discover more art. |
| **Mobile-First** | Designed for on-the-go use with camera toggle (front/back), responsive layout, and touch-friendly UI. |

---

## Tech Stack

### Frontend
- **React 19** with Vite for fast builds and HMR
- **Firebase Auth** (client-side) for login/signup
- Plain CSS — no UI framework, fully custom design
- Page-based state management (no router needed for a 2-page app)

### Backend
- **FastAPI** serving both the API and the built frontend as static files
- **Firebase Admin SDK** for server-side token verification
- **Cloud Firestore** for user profiles, gallery images, and leaderboard data
- **OpenAI CLIP** (`clip-vit-base-patch32`) for image similarity inference on CPU

### Infrastructure
- **Google Cloud Run** (serverless container hosting)
- **Cloud Build** triggered by GitHub Actions on push to `main`
- **Docker** multi-stage build (Node for frontend, Python for backend + ML model)
- **GCP Secret Manager** for Firebase service account credentials

---

## Architecture Overview

```
                        Firebase Auth
                        (Google servers)
                             |
                         ID Token (JWT)
                             |
    +------------------------+------------------------+
    |         FRONTEND (React 19 + Vite)              |
    |                                                  |
    |  AuthContext --- Header --- Gallery --- Camera    |
    +------------------------+------------------------+
                             |
                    Authorization: Bearer <token>
                             |
    +------------------------+------------------------+
    |          BACKEND (FastAPI on Cloud Run)          |
    |                                                  |
    |  /api/verify  -----> CLIP Service (PyTorch)      |
    |  /api/gallery -----> Firestore (gallery docs)    |
    |  /api/auth/me -----> Firestore (user profiles)   |
    |  /api/leaderboard -> Firestore (user rankings)   |
    +------------------------+------------------------+
                             |
              Cloud Firestore       CLIP Model
              (users, gallery)      (48 reference images)
```

---

## How the AI Verification Works

1. User uploads or captures a photo
2. The image is sent to the backend as `multipart/form-data`
3. CLIP generates a **512-dimensional embedding** of the uploaded image
4. **Cosine similarity** is computed against pre-computed embeddings of all ~48 reference images
5. The top-k similarities are averaged for robustness
6. Raw similarity is scaled to a **0-100% confidence** score
7. **80%+ confidence** = verified as Anna Laurini's art

No model fine-tuning is involved — CLIP's pre-trained vision-language representations are powerful enough for zero-shot image matching.

---

## API Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|:----:|---------|
| `POST` | `/api/verify` | No | Verify an artwork image |
| `GET` | `/api/auth/me` | Yes | Get user profile and stats |
| `GET` | `/api/gallery` | No | Browse public gallery (paginated) |
| `POST` | `/api/gallery` | Yes | Save a verified image |
| `DELETE` | `/api/gallery/{id}` | Yes | Delete own gallery image |
| `GET` | `/api/leaderboard` | No | Top users ranked by discoveries |
| `GET` | `/api/gallery/stats` | No | Gallery-wide statistics |
| `GET` | `/api/health` | No | Health check and system info |

---

## Deployment Pipeline

```
GitHub (push to main)
        |
        v
GitHub Actions
        |
        v
Google Cloud Build (E2_HIGHCPU_32)
   - Build multi-stage Docker image
   - Pre-download CLIP model into image layer
   - Push to Artifact Registry
        |
        v
Google Cloud Run (europe-west1)
   - 4 GiB RAM, 2 vCPU
   - Serves frontend + API from single container
   - Firebase credentials from Secret Manager
```

---

## Local Development

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Vite dev server at http://localhost:5173
# API calls proxied to http://localhost:8000
```

---

## Project Structure

```
spot_the_artist/
├── frontend/                  # React 19 SPA
│   ├── src/
│   │   ├── App.jsx            # Main app, state management, verification flow
│   │   ├── firebase.js        # Firebase SDK config
│   │   ├── components/        # AuthModal, Camera, Gallery, Header, etc.
│   │   └── contexts/          # AuthContext (global auth state)
│   └── dist/                  # Production build output
│
├── backend/                   # FastAPI server
│   ├── app/
│   │   ├── main.py            # Routes, app lifecycle, frontend serving
│   │   ├── auth.py            # Firebase token verification, user CRUD
│   │   ├── database.py        # Firestore client
│   │   ├── gallery_service.py # Gallery CRUD, image compression
│   │   └── clip_service.py    # CLIP model loading, image verification
│   └── reference_art/         # ~48 reference images of Anna Laurini's art
│
├── Dockerfile                 # Multi-stage build (Node + Python)
├── cloudbuild.yaml            # Google Cloud Build config
└── .github/workflows/         # CI/CD via GitHub Actions
```

---

## What I Learned

- **Zero-shot image matching with CLIP** — leveraging pre-trained vision-language models for domain-specific similarity without any fine-tuning
- **Firebase Auth + FastAPI integration** — client-side Firebase SDK for auth flows, server-side Admin SDK for stateless token verification
- **Firestore data modeling** — designing document schemas for user profiles and gallery items with denormalized data for query efficiency
- **Docker multi-stage builds** — combining Node and Python runtimes into a single image while keeping layers cacheable (especially the ~350MB CLIP model)
- **Cloud Run deployment** — managing cold starts for a large ML model, injecting secrets, and configuring CI/CD with GitHub Actions + Cloud Build

---

## License

MIT
