"""
Authentication utilities for Spot the Artist.
Uses Firebase Admin SDK to verify ID tokens from the frontend.
User records stored in Cloud Firestore.
"""

import os
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth, firestore
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from .database import get_db

# Initialize Firebase Admin SDK
# Priority: 1) FIREBASE_SERVICE_ACCOUNT_JSON env var (inline JSON, for Cloud Run)
#           2) GOOGLE_APPLICATION_CREDENTIALS env var (file path)
#           3) Auto-detect firebase-service-account.json in backend/ directory
#           4) Default credentials (GCP environments)
if not firebase_admin._apps:
    service_account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    local_key_path = Path(__file__).parent.parent / "firebase-service-account.json"

    if service_account_json:
        cred = credentials.Certificate(json.loads(service_account_json))
        firebase_admin.initialize_app(cred)
    elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        firebase_admin.initialize_app()
    elif local_key_path.exists():
        cred = credentials.Certificate(str(local_key_path))
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()

# Security
security = HTTPBearer(auto_error=False)


# Pydantic models
class UserResponse(BaseModel):
    """Response model for user data."""
    id: str
    username: str
    email: str
    arts_spotted: int
    verified_spots: int
    created_at: datetime


class LeaderboardEntry(BaseModel):
    """Entry in the leaderboard."""
    rank: int
    username: str
    arts_spotted: int
    verified_spots: int


def verify_firebase_token(token: str) -> dict:
    """Verify a Firebase ID token and return the decoded claims."""
    try:
        return firebase_auth.verify_id_token(token)
    except Exception:
        return None


def get_or_create_user(uid: str, email: str, username: str) -> dict:
    """Look up a user by Firebase UID, creating a new record if needed."""
    db = get_db()
    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()

    if user_doc.exists:
        data = user_doc.to_dict()
        data["id"] = uid
        return data

    # Create new user document
    now = datetime.utcnow()
    user_data = {
        "username": username,
        "email": email,
        "created_at": now,
        "arts_spotted": 0,
        "verified_spots": 0,
    }
    user_ref.set(user_data)

    user_data["id"] = uid
    return user_data


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """FastAPI dependency to get the current authenticated user."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    decoded = verify_firebase_token(credentials.credentials)
    if decoded is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    uid = decoded["uid"]
    email = decoded.get("email", "")
    username = decoded.get("name", email.split("@")[0] if email else uid[:8])

    return get_or_create_user(uid, email, username)


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Optional[dict]:
    """FastAPI dependency to optionally get the current user (doesn't require auth)."""
    if credentials is None:
        return None

    decoded = verify_firebase_token(credentials.credentials)
    if decoded is None:
        return None

    uid = decoded["uid"]
    email = decoded.get("email", "")
    username = decoded.get("name", email.split("@")[0] if email else uid[:8])

    return get_or_create_user(uid, email, username)


def get_leaderboard(limit: int = 10) -> list[LeaderboardEntry]:
    """Get the top users by arts_spotted."""
    db = get_db()
    users_ref = db.collection("users")
    query = users_ref.order_by("arts_spotted", direction=firestore.Query.DESCENDING).limit(limit)
    docs = query.stream()

    return [
        LeaderboardEntry(
            rank=i + 1,
            username=doc.to_dict().get("username", "Unknown"),
            arts_spotted=doc.to_dict().get("arts_spotted", 0),
            verified_spots=doc.to_dict().get("verified_spots", 0),
        )
        for i, doc in enumerate(docs)
    ]
