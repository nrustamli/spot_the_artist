"""
Anna Laurini Art Verification API

FastAPI server that handles database operations (auth, gallery) locally
and can run CLIP verification either locally or via a remote backend.
"""

import os
import io
import httpx
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from PIL import Image

from .database import init_db
from .auth import (
    UserResponse, LeaderboardEntry,
    get_current_user, get_leaderboard,
)
from .gallery_service import (
    GalleryImageCreate, GalleryImageResponse, GalleryListResponse,
    save_to_gallery, get_gallery_items, get_gallery_item, delete_gallery_item,
    get_gallery_stats
)

# Import CLIP service for local verification
from .clip_service import get_clip_service, CLIPService


# Response models
class VerificationResponse(BaseModel):
    """Response model for art verification."""
    is_verified: bool
    confidence: float
    message: str
    best_match: str | None = None


class HealthResponse(BaseModel):
    """Response model for health check."""
    status: str
    mode: str
    clip_backend: str | None = None
    reference_images: int | None = None
    database_connected: bool = True


# Remote CLIP backend URL (Colab with ngrok)
# If not set, will use local CLIP service
CLIP_BACKEND_URL = os.environ.get("CLIP_BACKEND_URL", "")

# Reference art directory for local CLIP
REFERENCE_ART_DIR = os.environ.get("REFERENCE_ART_DIR", "reference_art")

# HTTP client for proxying requests (when using remote backend)
http_client: httpx.AsyncClient | None = None

# Local CLIP service (when running standalone)
clip_service: CLIPService | None = None

# Supported image content types (including HEIC)
SUPPORTED_IMAGE_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "image/heic", "image/heif"
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize CLIP service and HTTP client on startup."""
    global http_client, clip_service

    # Initialize Firestore
    init_db()

    # Initialize HTTP client for proxying to Colab (if using remote backend)
    http_client = httpx.AsyncClient(timeout=60.0)

    if CLIP_BACKEND_URL:
        print(f"🔗 Using remote CLIP backend: {CLIP_BACKEND_URL}")
    else:
        # Load local CLIP service
        print(f"🔧 Loading local CLIP service (reference_art: {REFERENCE_ART_DIR})")
        try:
            clip_service = get_clip_service(REFERENCE_ART_DIR)
            print(f"✅ Local CLIP service ready with {clip_service.get_reference_count()} reference images")
        except Exception as e:
            print(f"❌ Failed to load CLIP service: {e}")
            clip_service = None

    yield

    # Cleanup
    if http_client:
        await http_client.aclose()
    print("👋 Shutting down")


# Create FastAPI app
app = FastAPI(
    title="Anna Laurini Art Verification API",
    description="AI-powered verification of Anna Laurini street art using CLIP",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler to always return JSON errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all unhandled exceptions and return them as JSON."""
    import traceback
    print(f"❌ Unhandled exception: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)}
    )


@app.get("/api/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Check if the service is running and ready."""
    return HealthResponse(
        status="healthy",
        mode="proxy" if CLIP_BACKEND_URL else "standalone",
        clip_backend=CLIP_BACKEND_URL or None,
        reference_images=clip_service.get_reference_count() if clip_service else None,
        database_connected=True
    )


@app.post("/api/verify", response_model=VerificationResponse, tags=["Verification"])
async def verify_artwork(file: UploadFile = File(...)):
    """
    Verify if an uploaded image matches Anna Laurini's artwork.

    Uses local CLIP service or proxies to remote backend if configured.
    Supports JPEG, PNG, WebP, and HEIC/HEIF image formats.
    """
    # Validate file type (support HEIC and standard formats)
    content_type = file.content_type or ""
    filename = file.filename or ""

    # Check by content type or file extension for HEIC (some browsers don't send correct MIME)
    is_valid_type = (
        content_type.startswith("image/") or
        filename.lower().endswith(('.heic', '.heif'))
    )

    if not is_valid_type:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an image (JPEG, PNG, WebP, HEIC)."
        )

    try:
        # Read file contents
        contents = await file.read()

        # Use remote backend if configured
        if CLIP_BACKEND_URL:
            files = {"file": (file.filename, contents, file.content_type)}
            response = await http_client.post(
                f"{CLIP_BACKEND_URL}/api/verify",
                files=files,
                headers={"ngrok-skip-browser-warning": "true"}
            )

            if response.status_code != 200:
                error_detail = response.json().get("detail", "Verification failed")
                raise HTTPException(status_code=response.status_code, detail=error_detail)

            result = response.json()

            return VerificationResponse(
                is_verified=result["is_verified"],
                confidence=result["confidence"],
                message=result["message"],
                best_match=result.get("best_match")
            )

        # Use local CLIP service
        if clip_service is None:
            raise HTTPException(
                status_code=503,
                detail="CLIP service not available. Please try again later."
            )

        # Load image with PIL (supports HEIC via pillow-heif)
        image = Image.open(io.BytesIO(contents)).convert("RGB")

        # Verify with local CLIP
        result = clip_service.verify_image(image)

        return VerificationResponse(
            is_verified=result["is_verified"],
            confidence=result["confidence"],
            message=result["message"],
            best_match=result.get("best_match")
        )

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Cannot reach CLIP backend: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing image: {str(e)}"
        )


# =============================================================================
# Authentication Endpoints
# =============================================================================

@app.get("/api/auth/me", response_model=UserResponse, tags=["Authentication"])
async def get_current_user_info(user: dict = Depends(get_current_user)):
    """Get the current authenticated user's information."""
    return UserResponse(**user)


@app.get("/api/leaderboard", response_model=list[LeaderboardEntry], tags=["Users"])
async def leaderboard(limit: int = Query(default=10, ge=1, le=100)):
    """Get the top users by number of artworks spotted."""
    return get_leaderboard(limit)


# =============================================================================
# Gallery Endpoints
# =============================================================================

@app.post("/api/gallery", response_model=GalleryImageResponse, tags=["Gallery"])
async def add_to_gallery(
    image_data: GalleryImageCreate,
    user: dict = Depends(get_current_user),
):
    """
    Save a verified artwork image to the shared gallery.

    Requires authentication. The image will be associated with the current user.
    """
    gallery_image = save_to_gallery(user, image_data)

    return GalleryImageResponse(
        id=gallery_image["id"],
        user_id=gallery_image["user_id"],
        username=gallery_image["username"],
        image_data=gallery_image["image_data"],
        is_verified=gallery_image["is_verified"],
        confidence=gallery_image["confidence"],
        message=gallery_image.get("message"),
        best_match=gallery_image.get("best_match"),
        location=gallery_image.get("location"),
        notes=gallery_image.get("notes"),
        created_at=gallery_image["created_at"],
    )


@app.get("/api/gallery", response_model=GalleryListResponse, tags=["Gallery"])
async def list_gallery(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    user_id: Optional[str] = Query(default=None),
    verified_only: bool = Query(default=False),
):
    """
    Get the shared gallery of all uploaded artworks.

    - Public endpoint (no authentication required)
    - Returns paginated results, newest first
    - Can filter by user_id or verified_only
    """
    return get_gallery_items(page, per_page, user_id, verified_only)


@app.get("/api/gallery/stats", tags=["Gallery"])
async def gallery_stats():
    """Get overall gallery statistics."""
    return get_gallery_stats()


@app.get("/api/gallery/{item_id}", response_model=GalleryImageResponse, tags=["Gallery"])
async def get_gallery_image(item_id: str):
    """Get a specific gallery image by ID."""
    item = get_gallery_item(item_id)

    if item is None:
        raise HTTPException(status_code=404, detail="Image not found")

    return GalleryImageResponse(
        id=item["id"],
        user_id=item["user_id"],
        username=item.get("username", "Unknown"),
        image_data=item["image_data"],
        is_verified=item.get("is_verified", False),
        confidence=item.get("confidence", 0.0),
        message=item.get("message"),
        best_match=item.get("best_match"),
        location=item.get("location"),
        notes=item.get("notes"),
        created_at=item.get("created_at"),
    )


@app.delete("/api/gallery/{item_id}", tags=["Gallery"])
async def remove_from_gallery(
    item_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Delete an image from the gallery.

    Requires authentication. Users can only delete their own images.
    """
    success = delete_gallery_item(item_id, user)

    if not success:
        raise HTTPException(
            status_code=404,
            detail="Image not found or you don't have permission to delete it"
        )

    return {"status": "success", "message": "Image deleted"}


# Serve static frontend files in production
# Check multiple possible locations for frontend build
possible_frontend_paths = [
    Path(__file__).parent.parent.parent / "frontend" / "dist",  # Development
    Path("/app/frontend/dist"),  # Docker container
]

frontend_build = None
for path in possible_frontend_paths:
    if path.exists() and (path / "index.html").exists():
        frontend_build = path
        print(f"📦 Serving frontend from: {frontend_build}")
        break

if frontend_build:
    # Mount assets directory
    assets_dir = frontend_build / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", tags=["Frontend"])
    async def serve_frontend():
        """Serve the React frontend."""
        return FileResponse(frontend_build / "index.html")

    @app.get("/{full_path:path}", tags=["Frontend"])
    async def serve_frontend_routes(full_path: str):
        """Serve React frontend for all routes (SPA support)."""
        # Check if it's an API route
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")

        # Check if file exists in static folder
        file_path = frontend_build / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)

        # Return index.html for SPA routing
        return FileResponse(frontend_build / "index.html")
else:
    print("⚠️ Frontend build not found - API-only mode")
