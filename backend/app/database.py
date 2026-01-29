"""
Database configuration and models for Spot the Artist.
Uses SQLite with SQLAlchemy ORM.
"""

import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

# Database URL - use SQLite file in data directory
DATABASE_DIR = os.environ.get("DATABASE_DIR", "data")
os.makedirs(DATABASE_DIR, exist_ok=True)
DATABASE_URL = f"sqlite:///{DATABASE_DIR}/spot_the_artist.db"

# Create engine with SQLite-specific settings
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Needed for SQLite with FastAPI
    echo=False
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


class User(Base):
    """User account for tracking art discoveries."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Email verification
    email_verified = Column(Boolean, default=False)
    verification_token = Column(String(100), nullable=True)
    verification_token_expires = Column(DateTime, nullable=True)
    
    # Statistics
    arts_spotted = Column(Integer, default=0)
    verified_spots = Column(Integer, default=0)
    
    # Relationships
    gallery_images = relationship("GalleryImage", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(username='{self.username}', arts_spotted={self.arts_spotted})>"


class GalleryImage(Base):
    """Uploaded artwork images shared in the gallery."""
    __tablename__ = "gallery_images"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Image data (stored as base64)
    image_data = Column(Text, nullable=False)
    thumbnail_data = Column(Text, nullable=True)  # Optional smaller preview
    
    # Verification results
    is_verified = Column(Boolean, default=False)
    confidence = Column(Float, default=0.0)
    message = Column(String(500), nullable=True)
    best_match = Column(String(200), nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    location = Column(String(200), nullable=True)  # Optional location info
    notes = Column(Text, nullable=True)  # User notes about the artwork
    
    # Relationships
    user = relationship("User", back_populates="gallery_images")
    
    def __repr__(self):
        return f"<GalleryImage(id={self.id}, user_id={self.user_id}, verified={self.is_verified})>"


def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)
    print("✅ Database initialized")


def get_db():
    """Get database session - use as FastAPI dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

