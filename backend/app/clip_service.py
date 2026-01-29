"""
CLIP-based Art Verification Service

This service uses OpenAI's CLIP model to compare uploaded images
against a reference database of Anna Laurini's artwork.
"""

import os
from pathlib import Path
from typing import Optional
import numpy as np
from PIL import Image
import torch
from transformers import CLIPProcessor, CLIPModel

# Register HEIC/HEIF support with Pillow
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    HEIC_SUPPORTED = True
    print("✅ HEIC/HEIF support enabled")
except ImportError:
    HEIC_SUPPORTED = False
    print("⚠️ HEIC/HEIF support not available (install pillow-heif)")


class CLIPService:
    """Service for verifying artwork using CLIP embeddings."""
    
    MODEL_NAME = "openai/clip-vit-base-patch32"
    SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
    
    def __init__(self, reference_dir: str = "reference_art"):
        """
        Initialize the CLIP service.
        
        Args:
            reference_dir: Path to directory containing reference artwork images
        """
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"🔧 Using device: {self.device}")
        
        # Load CLIP model and processor
        print(f"📥 Loading CLIP model: {self.MODEL_NAME}")
        self.model = CLIPModel.from_pretrained(self.MODEL_NAME).to(self.device)
        self.processor = CLIPProcessor.from_pretrained(self.MODEL_NAME, use_fast=True)
        self.model.eval()
        print(f"✅ CLIP model loaded successfully (type: {type(self.model).__name__})")
        
        # Store reference embeddings
        self.reference_embeddings: Optional[torch.Tensor] = None
        self.reference_names: list[str] = []
        
        # Load reference images
        self.reference_dir = Path(reference_dir)
        self._load_reference_images()
    
    def _load_reference_images(self) -> None:
        """Load and cache embeddings for all reference images."""
        if not self.reference_dir.exists():
            print(f"⚠️ Reference directory not found: {self.reference_dir}")
            return
        
        # Find all supported image files
        image_files = [
            f for f in self.reference_dir.iterdir()
            if f.suffix.lower() in self.SUPPORTED_EXTENSIONS
        ]
        
        if not image_files:
            print(f"⚠️ No reference images found in {self.reference_dir}")
            return
        
        print(f"📚 Loading {len(image_files)} reference images...")
        
        embeddings = []
        for img_path in image_files:
            try:
                embedding = self._get_image_embedding(img_path)
                embeddings.append(embedding)
                self.reference_names.append(img_path.name)
            except Exception as e:
                print(f"❌ Error loading {img_path.name}: {e}")
        
        if embeddings:
            self.reference_embeddings = torch.cat(embeddings, dim=0)
            print(f"✅ Loaded {len(embeddings)} reference embeddings")
        else:
            print("⚠️ No embeddings loaded")
    
    def _get_image_embedding(self, image_path: Path | str) -> torch.Tensor:
        """
        Get CLIP embedding for a single image file.
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Normalized embedding tensor of shape (1, 512)
        """
        image = Image.open(image_path).convert("RGB")
        return self._embed_image(image)
    
    def _embed_image(self, image: Image.Image) -> torch.Tensor:
        """
        Get CLIP embedding for a PIL Image.
        
        Args:
            image: PIL Image object
            
        Returns:
            Normalized embedding tensor of shape (1, 512)
        """
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        
        with torch.no_grad():
            outputs = self.model.get_image_features(**inputs)
            # Handle both old (tensor) and new (object with .last_hidden_state) API
            if hasattr(outputs, 'image_embeds'):
                image_features = outputs.image_embeds
            elif hasattr(outputs, 'pooler_output'):
                image_features = outputs.pooler_output
            elif isinstance(outputs, torch.Tensor):
                image_features = outputs
            else:
                # Fallback: try to get the tensor directly
                image_features = outputs
        
        # Normalize for cosine similarity
        image_features = image_features / torch.norm(image_features, dim=-1, keepdim=True)
        return image_features
    
    def verify_image(self, image: Image.Image) -> dict:
        """
        Verify if an image matches Anna Laurini's artwork.
        
        Uses top-k matching for more robust verification:
        - Compares against all reference images
        - Uses average of top 3 matches to reduce noise
        - Higher threshold to reduce false positives
        
        Args:
            image: PIL Image to verify
            
        Returns:
            Dictionary with verification results:
            - is_verified: bool
            - confidence: float (0-100)
            - message: str
            - best_match: str (filename of closest reference)
        """
        if self.reference_embeddings is None or len(self.reference_embeddings) == 0:
            return {
                "is_verified": False,
                "confidence": 0.0,
                "message": "No reference images loaded. Please add reference artwork.",
                "best_match": None
            }
        
        # Get embedding for uploaded image
        query_embedding = self._embed_image(image)
        
        # Compute cosine similarity with all reference images
        similarities = torch.mm(query_embedding, self.reference_embeddings.t()).squeeze(0)
        
        # Get the best match
        best_similarity, best_idx = similarities.max(dim=0)
        best_similarity = best_similarity.item()
        best_match = self.reference_names[best_idx.item()]
        
        # Use top-k average for more robust scoring (reduces noise from single outliers)
        # Scale k based on number of reference images: ~10% of references, min 3, max 10
        k = max(3, min(10, len(self.reference_names) // 10 + 1))
        top_k_similarities, _ = similarities.topk(k)
        avg_top_k = top_k_similarities.mean().item()
        
        # Use the average of top-k for confidence calculation
        # This is more robust than using just the best match
        confidence = self._scale_similarity(avg_top_k)
        
        # Determine verification status with stricter threshold
        # Threshold raised to 80% to reduce false positives
        if confidence >= 80:
            is_verified = True
            message = "✅ Verified! This looks like Anna Laurini's artwork!"
        else:
            is_verified = False
            message = "❌ Not recognized as Anna Laurini's artwork."
        
        return {
            "is_verified": is_verified,
            "confidence": round(confidence, 1),
            "message": message,
            "best_match": best_match,
            "raw_similarity": round(best_similarity, 4),
            "avg_top_k_similarity": round(avg_top_k, 4)
        }
    
    def _scale_similarity(self, similarity: float) -> float:
        """
        Scale raw CLIP similarity to a 0-100 confidence score.
        
        Based on empirical CLIP similarity ranges:
        - Same/very similar images: 0.85 - 1.00 (exact or near-exact match)
        - Same style/artist: 0.70 - 0.85 (strong match)
        - Related content: 0.50 - 0.70 (moderate match)
        - Different content: 0.20 - 0.50 (weak match)
        - Unrelated: < 0.20 (no match)
        
        Mapping to confidence:
        - 0.80+ -> 90-100% (verified)
        - 0.70-0.80 -> 75-90% (likely match)
        - 0.55-0.70 -> 50-75% (uncertain)
        - 0.40-0.55 -> 25-50% (unlikely)
        - < 0.40 -> 0-25% (no match)
        """
        # Clamp to valid range
        similarity = max(0.0, min(1.0, similarity))
        
        # Piecewise linear scaling with cap at 100%
        if similarity >= 0.80:
            # 0.80-1.00 -> 90-100% (capped)
            score = 90 + (similarity - 0.80) / 0.20 * 10
            return min(100.0, score)
        elif similarity >= 0.70:
            # 0.70-0.80 -> 75-90%
            return 75 + (similarity - 0.70) / 0.10 * 15
        elif similarity >= 0.55:
            # 0.55-0.70 -> 50-75%
            return 50 + (similarity - 0.55) / 0.15 * 25
        elif similarity >= 0.40:
            # 0.40-0.55 -> 25-50%
            return 25 + (similarity - 0.40) / 0.15 * 25
        else:
            # 0.00-0.40 -> 0-25%
            return similarity / 0.40 * 25
    
    def get_reference_count(self) -> int:
        """Return the number of loaded reference images."""
        return len(self.reference_names)
    
    def reload_references(self) -> None:
        """Reload reference images from disk."""
        self.reference_embeddings = None
        self.reference_names = []
        self._load_reference_images()


# Singleton instance for the application
_clip_service: Optional[CLIPService] = None


def get_clip_service(reference_dir: str = "reference_art") -> CLIPService:
    """
    Get or create the CLIP service singleton.
    
    Args:
        reference_dir: Path to reference images directory
        
    Returns:
        CLIPService instance
    """
    global _clip_service
    if _clip_service is None:
        _clip_service = CLIPService(reference_dir)
    return _clip_service

