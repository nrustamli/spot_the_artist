"""
Authentication utilities for Spot the Artist.
Simple token-based auth with bcrypt password hashing.
"""

import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional
from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.orm import Session

from .database import get_db, User
from .email_service import generate_verification_token, send_verification_email

# Simple token storage (in production, use Redis or JWT)
# Format: {token: {"user_id": id, "expires": datetime}}
active_tokens: dict = {}

# Security
security = HTTPBearer(auto_error=False)

# Token expiration (7 days)
TOKEN_EXPIRATION_DAYS = 7


# Pydantic models for requests/responses
class UserCreate(BaseModel):
    """Request model for user registration."""
    username: str = Field(..., min_length=3, max_length=50, pattern="^[a-zA-Z0-9_]+$")
    email: EmailStr = Field(..., description="Valid email address for verification")
    password: str = Field(..., min_length=6, max_length=100)


class UserLogin(BaseModel):
    """Request model for user login."""
    username: str
    password: str


class UserResponse(BaseModel):
    """Response model for user data."""
    id: int
    username: str
    email: str
    email_verified: bool
    arts_spotted: int
    verified_spots: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class VerifyEmailRequest(BaseModel):
    """Request model for email verification."""
    token: str


class ResendVerificationRequest(BaseModel):
    """Request model for resending verification email."""
    email: EmailStr


class TokenResponse(BaseModel):
    """Response model for authentication token."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class LeaderboardEntry(BaseModel):
    """Entry in the leaderboard."""
    rank: int
    username: str
    arts_spotted: int
    verified_spots: int


def hash_password(password: str) -> str:
    """Hash a password using SHA-256 with salt."""
    # In production, use bcrypt - keeping it simple here without extra dependencies
    salt = os.environ.get("PASSWORD_SALT", "spot_the_artist_2024")
    return hashlib.sha256(f"{password}{salt}".encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return hash_password(plain_password) == hashed_password


def create_token(user_id: int) -> str:
    """Create a new authentication token for a user."""
    token = secrets.token_urlsafe(32)
    active_tokens[token] = {
        "user_id": user_id,
        "expires": datetime.utcnow() + timedelta(days=TOKEN_EXPIRATION_DAYS)
    }
    return token


def verify_token(token: str) -> Optional[int]:
    """Verify a token and return the user_id if valid."""
    if token not in active_tokens:
        return None
    
    token_data = active_tokens[token]
    if datetime.utcnow() > token_data["expires"]:
        del active_tokens[token]
        return None
    
    return token_data["user_id"]


def revoke_token(token: str) -> bool:
    """Revoke/invalidate a token."""
    if token in active_tokens:
        del active_tokens[token]
        return True
    return False


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """FastAPI dependency to get the current authenticated user."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = verify_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """FastAPI dependency to optionally get the current user (doesn't require auth)."""
    if credentials is None:
        return None
    
    user_id = verify_token(credentials.credentials)
    if user_id is None:
        return None
    
    return db.query(User).filter(User.id == user_id).first()


# Auth service functions
async def register_user(db: Session, user_data: UserCreate) -> User:
    """Register a new user and send verification email."""
    # Check if username already exists
    existing = db.query(User).filter(User.username == user_data.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Check if email already exists
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Generate verification token
    token, expires = generate_verification_token()
    
    # Create new user
    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        email_verified=False,
        verification_token=token,
        verification_token_expires=expires
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Send verification email (non-blocking)
    await send_verification_email(user.email, user.username, token)
    
    return user


def verify_user_email(db: Session, token: str) -> User:
    """Verify a user's email using the verification token."""
    user = db.query(User).filter(User.verification_token == token).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )
    
    if user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified"
        )
    
    if user.verification_token_expires and datetime.utcnow() > user.verification_token_expires:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired. Please request a new one."
        )
    
    # Mark email as verified
    user.email_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()
    db.refresh(user)
    
    return user


async def resend_verification_email(db: Session, email: str) -> bool:
    """Resend verification email to a user."""
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # Don't reveal if email exists
        return True
    
    if user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified"
        )
    
    # Generate new token
    token, expires = generate_verification_token()
    user.verification_token = token
    user.verification_token_expires = expires
    db.commit()
    
    # Send email
    await send_verification_email(user.email, user.username, token)
    
    return True


def authenticate_user(db: Session, username_or_email: str, password: str) -> Optional[User]:
    """Authenticate a user by username or email and password."""
    # Try to find user by username first, then by email
    user = db.query(User).filter(User.username == username_or_email).first()
    if user is None:
        # Try email
        user = db.query(User).filter(User.email == username_or_email).first()
    
    if user is None:
        return None
    
    if not verify_password(password, user.password_hash):
        return None
    
    # Check if email is verified
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before logging in. Check your inbox for the verification link."
        )
    
    return user


def get_leaderboard(db: Session, limit: int = 10) -> list[LeaderboardEntry]:
    """Get the top users by arts_spotted."""
    users = db.query(User).order_by(User.arts_spotted.desc()).limit(limit).all()
    
    return [
        LeaderboardEntry(
            rank=i + 1,
            username=user.username,
            arts_spotted=user.arts_spotted,
            verified_spots=user.verified_spots
        )
        for i, user in enumerate(users)
    ]

