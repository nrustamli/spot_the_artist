"""
Database configuration for Spot the Artist.
Uses Cloud Firestore via Firebase Admin SDK.
"""

from firebase_admin import firestore

# Firestore client (lazy-initialized)
_db = None


def get_db():
    """Get Firestore client instance."""
    global _db
    if _db is None:
        _db = firestore.client()
    return _db


def init_db():
    """Initialize database connection. Firestore creates collections on first write."""
    get_db()
    print("✅ Firestore initialized")
