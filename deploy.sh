#!/bin/bash
# Quick deploy script for Spot the Artist

echo "🚀 Deploying to Cloud Run..."

gcloud run deploy spot-the-artist \
  --source . \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 300

echo "✅ Deployment complete!"
echo "🌐 https://spot-the-artist-373413279391.europe-west1.run.app/"
