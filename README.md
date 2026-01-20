# Spot the Artist - Anna Laurini Art Verification

A "Pokémon GO" style web app for street art discovery. Fans of artist Anna Laurini can explore cities to find her iconic "Face" artworks and use AI to verify their finds.

## Features

- 📸 **Camera Capture** - Snap photos directly in the app
- 📤 **File Upload** - Upload existing photos
- 🤖 **AI Verification** - CLIP-powered art recognition
- 📱 **Mobile-First** - Designed for on-the-go use

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Python + FastAPI + CLIP
- **Deployment:** Hugging Face Spaces (Docker)

## Project Structure

```
spot_the_artist/
├── frontend/          # React application
├── backend/           # Python API server
│   ├── app/           # FastAPI application
│   └── reference_art/ # Reference images for AI
├── Dockerfile         # HF Spaces deployment
└── README.md
```

## Local Development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Adding Reference Images

Place 15-20 high-quality images of Anna Laurini's artwork in `backend/reference_art/`. These images are used by the AI to verify user uploads.

Supported formats: `.jpg`, `.jpeg`, `.png`, `.webp`

## Deployment

The app is deployed to Hugging Face Spaces using Docker. Push to the connected repository to trigger automatic deployment.

## License

MIT

