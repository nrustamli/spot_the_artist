"""
Gallery service for managing shared artwork images.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .database import GalleryImage, User


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
    id: int
    user_id: int
    username: str
    display_name: Optional[str]
    image_data: str
    is_verified: bool
    confidence: float
    message: Optional[str]
    best_match: Optional[str]
    location: Optional[str]
    notes: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class GalleryListResponse(BaseModel):
    """Response model for gallery list."""
    items: List[GalleryImageResponse]
    total: int
    page: int
    per_page: int
    has_more: bool


def save_to_gallery(
    db: Session,
    user: User,
    image_data: GalleryImageCreate
) -> GalleryImage:
    """Save an image to the gallery."""
    gallery_image = GalleryImage(
        user_id=user.id,
        image_data=image_data.image_data,
        is_verified=image_data.is_verified,
        confidence=image_data.confidence,
        message=image_data.message,
        best_match=image_data.best_match,
        location=image_data.location,
        notes=image_data.notes
    )
    
    db.add(gallery_image)
    
    # Update user stats
    user.arts_spotted += 1
    if image_data.is_verified:
        user.verified_spots += 1
    
    db.commit()
    db.refresh(gallery_image)
    
    return gallery_image


def get_gallery_items(
    db: Session,
    page: int = 1,
    per_page: int = 20,
    user_id: Optional[int] = None,
    verified_only: bool = False
) -> GalleryListResponse:
    """Get paginated gallery items."""
    query = db.query(GalleryImage).join(User)
    
    # Apply filters
    if user_id is not None:
        query = query.filter(GalleryImage.user_id == user_id)
    
    if verified_only:
        query = query.filter(GalleryImage.is_verified == True)
    
    # Get total count
    total = query.count()
    
    # Order by newest first and paginate
    items = query.order_by(GalleryImage.created_at.desc())\
        .offset((page - 1) * per_page)\
        .limit(per_page)\
        .all()
    
    # Convert to response format
    response_items = [
        GalleryImageResponse(
            id=item.id,
            user_id=item.user_id,
            username=item.user.username,
            display_name=item.user.display_name,
            image_data=item.image_data,
            is_verified=item.is_verified,
            confidence=item.confidence,
            message=item.message,
            best_match=item.best_match,
            location=item.location,
            notes=item.notes,
            created_at=item.created_at
        )
        for item in items
    ]
    
    return GalleryListResponse(
        items=response_items,
        total=total,
        page=page,
        per_page=per_page,
        has_more=(page * per_page) < total
    )


def get_gallery_item(db: Session, item_id: int) -> Optional[GalleryImage]:
    """Get a single gallery item by ID."""
    return db.query(GalleryImage).filter(GalleryImage.id == item_id).first()


def delete_gallery_item(db: Session, item_id: int, user: User) -> bool:
    """Delete a gallery item. User can only delete their own images."""
    item = db.query(GalleryImage).filter(
        GalleryImage.id == item_id,
        GalleryImage.user_id == user.id
    ).first()
    
    if item is None:
        return False
    
    # Update user stats
    user.arts_spotted = max(0, user.arts_spotted - 1)
    if item.is_verified:
        user.verified_spots = max(0, user.verified_spots - 1)
    
    db.delete(item)
    db.commit()
    
    return True


def get_gallery_stats(db: Session) -> dict:
    """Get overall gallery statistics."""
    total_images = db.query(GalleryImage).count()
    verified_images = db.query(GalleryImage).filter(GalleryImage.is_verified == True).count()
    total_users = db.query(User).count()
    
    return {
        "total_images": total_images,
        "verified_images": verified_images,
        "total_users": total_users,
        "verification_rate": round(verified_images / total_images * 100, 1) if total_images > 0 else 0
    }

