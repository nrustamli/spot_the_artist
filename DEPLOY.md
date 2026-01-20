# Deployment Guide for Hugging Face Spaces

## Prerequisites

1. A Hugging Face account (free at [huggingface.co](https://huggingface.co))
2. Your reference images of Anna Laurini's artwork (15-20 images)

## Step 1: Add Reference Images

Place your reference images in the `backend/reference_art/` folder:

```
backend/reference_art/
├── anna_face_1.jpg
├── anna_face_2.jpg
├── anna_face_3.jpg
... (15-20 images)
```

Supported formats: `.jpg`, `.jpeg`, `.png`, `.webp`

## Step 2: Create a Hugging Face Space

1. Go to [huggingface.co/spaces](https://huggingface.co/spaces)
2. Click **"Create new Space"**
3. Fill in the details:
   - **Space name:** `spot-the-artist` (or your preferred name)
   - **License:** MIT
   - **SDK:** Docker
   - **Hardware:** CPU Basic (free) or upgrade for faster performance
4. Click **"Create Space"**

## Step 3: Deploy the Code

### Option A: Git Push (Recommended)

1. Clone your new Space:
```bash
git clone https://huggingface.co/spaces/YOUR_USERNAME/spot-the-artist
cd spot-the-artist
```

2. Copy all project files:
```bash
cp -r /path/to/spot_the_artist/* .
```

3. Rename the HF README:
```bash
mv HF_README.md README.md
```

4. Commit and push:
```bash
git add .
git commit -m "Initial deployment"
git push
```

### Option B: Upload via Web UI

1. Go to your Space's **Files** tab
2. Click **"Add file"** > **"Upload files"**
3. Upload all project files
4. Make sure to rename `HF_README.md` to `README.md`

## Step 4: Wait for Build

The build process takes 5-10 minutes. You can monitor progress in the **Logs** tab.

## Step 5: Test Your App

Once deployed, your app will be available at:
```
https://huggingface.co/spaces/YOUR_USERNAME/spot-the-artist
```

## Local Testing

Before deploying, you can test locally:

### Run Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Run Frontend (in another terminal)
```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## Troubleshooting

### "No reference images found"
- Make sure images are in `backend/reference_art/`
- Check file extensions are lowercase (.jpg, not .JPG)

### Build fails
- Check the Logs tab for errors
- Ensure all files were uploaded correctly

### Model loading is slow
- First load downloads the CLIP model (~350MB)
- Consider upgrading to GPU hardware for faster inference

## Updating Reference Images

To add more reference images after deployment:
1. Add new images to `backend/reference_art/`
2. Push changes to the repository
3. The Space will automatically rebuild

