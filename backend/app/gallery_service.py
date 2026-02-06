"""
Gallery service for managing shared artwork images.
Uses Cloud Firestore for storage.
Images are compressed to fit within Firestore's 1MB document limit.
"""

import base64
import io
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from PIL import Image

from firebase_admin import firestore
from .database import get_db

# Max image dimension (width or height) for gallery storage
MAX_IMAGE_SIZE = 800
# JPEG quality for compression
JPEG_QUALITY = 70


# Pydantic models
class GalleryImageCreate(BaseModel):
    """Request model for saving an image to gallery."""
    image_data: str  # Base64 encoded image
    is_verified: bool
    confidence: float
    message: Optional[str] = None
    best_match: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class GalleryImageResponse(BaseModel):
    """Response model for gallery image."""
    id: str
    user_id: str
    username: str
    image_data: str
    is_verified: bool
    confidence: float
    message: Optional[str]
    best_match: Optional[str]
    location: Optional[str]
    notes: Optional[str]
    created_at: datetime


class GalleryListResponse(BaseModel):
    """Response model for gallery list."""
    items: List[GalleryImageResponse]
    total: int
    page: int
    per_page: int
    has_more: bool


def _compress_image(base64_data: str) -> str:
    """Compress and resize a base64 image to fit within Firestore limits."""
    # Strip data URL prefix if present
    if "," in base64_data:
        base64_data = base64_data.split(",", 1)[1]

    image_bytes = base64.b64decode(base64_data)
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # Resize if too large
    img.thumbnail((MAX_IMAGE_SIZE, MAX_IMAGE_SIZE), Image.LANCZOS)

    # Compress as JPEG
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    compressed = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return f"data:image/jpeg;base64,{compressed}"


def save_to_gallery(user: dict, image_data: GalleryImageCreate) -> dict:
    """Save an image to the gallery."""
    db = get_db()
    now = datetime.utcnow()

    # Compress image to fit Firestore document size limit
    compressed_image = _compress_image(image_data.image_data)

    doc_data = {
        "user_id": user["id"],
        "username": user["username"],
        "image_data": compressed_image,
        "is_verified": image_data.is_verified,
        "confidence": image_data.confidence,
        "message": image_data.message,
        "best_match": image_data.best_match,
        "location": image_data.location,
        "notes": image_data.notes,
        "created_at": now,
    }

    # Add to gallery collection
    _, doc_ref = db.collection("gallery").add(doc_data)

    # Update user stats
    user_ref = db.collection("users").document(user["id"])
    updates = {"arts_spotted": firestore.Increment(1)}
    if image_data.is_verified:
        updates["verified_spots"] = firestore.Increment(1)
    user_ref.update(updates)

    doc_data["id"] = doc_ref.id
    return doc_data


def get_gallery_items(
    page: int = 1,
    per_page: int = 20,
    user_id: Optional[str] = None,
    verified_only: bool = False
) -> GalleryListResponse:
    """Get paginated gallery items."""
    db = get_db()
    collection_ref = db.collection("gallery")

    # Build query
    query = collection_ref.order_by("created_at", direction=firestore.Query.DESCENDING)

    if user_id is not None:
        query = query.where("user_id", "==", user_id)

    if verified_only:
        query = query.where("is_verified", "==", True)

    # Get total count
    count_query = query.count()
    count_result = count_query.get()
    total = count_result[0][0].value

    # Paginate
    offset = (page - 1) * per_page
    paginated_query = query.offset(offset).limit(per_page)
    docs = paginated_query.stream()

    items = []
    for doc in docs:
        data = doc.to_dict()
        items.append(GalleryImageResponse(
            id=doc.id,
            user_id=data.get("user_id", ""),
            username=data.get("username", "Unknown"),
            image_data=data.get("image_data", ""),
            is_verified=data.get("is_verified", False),
            confidence=data.get("confidence", 0.0),
            message=data.get("message"),
            best_match=data.get("best_match"),
            location=data.get("location"),
            notes=data.get("notes"),
            created_at=data.get("created_at", datetime.utcnow()),
        ))

    return GalleryListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        has_more=(page * per_page) < total,
    )


def get_gallery_item(item_id: str) -> Optional[dict]:
    """Get a single gallery item by ID."""
    db = get_db()
    doc = db.collection("gallery").document(item_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["id"] = doc.id
    return data


def delete_gallery_item(item_id: str, user: dict) -> bool:
    """Delete a gallery item. User can only delete their own images."""
    db = get_db()
    doc_ref = db.collection("gallery").document(item_id)
    doc = doc_ref.get()

    if not doc.exists:
        return False

    data = doc.to_dict()
    if data.get("user_id") != user["id"]:
        return False

    # Update user stats
    user_ref = db.collection("users").document(user["id"])
    updates = {"arts_spotted": firestore.Increment(-1)}
    if data.get("is_verified"):
        updates["verified_spots"] = firestore.Increment(-1)
    user_ref.update(updates)

    doc_ref.delete()
    return True


def get_gallery_stats() -> dict:
    """Get overall gallery statistics."""
    db = get_db()

    # Total images
    total_result = db.collection("gallery").count().get()
    total_images = total_result[0][0].value

    # Verified images
    verified_result = db.collection("gallery").where("is_verified", "==", True).count().get()
    verified_images = verified_result[0][0].value

    # Total users
    users_result = db.collection("users").count().get()
    total_users = users_result[0][0].value

    return {
        "total_images": total_images,
        "verified_images": verified_images,
        "total_users": total_users,
        "verification_rate": round(verified_images / total_images * 100, 1) if total_images > 0 else 0,
    }
