# Google Vision API Setup Guide

## Quick Setup (5 minutes)

### 1. Create Google Cloud Account
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Sign up for free (no credit card required for free tier)
3. Create a new project:
   - Click "Select a project" → "New Project"
   - Name it: `snap2invoice-ocr`

### 2. Enable Vision API
1. Go to **APIs & Services** → **Library**
2. Search for "Vision API" 
3. Click **Enable** (free tier automatically active)

### 3. Create Service Account
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **Service Account**
3. Name it: `ocr-service`
4. Click **Create and Continue**
5. Skip role assignment (click **Continue**)
6. Click **Done**

### 4. Download Key File
1. Find your service account in the list
2. Click on it → **Keys** tab
3. Click **Add Key** → **Create New Key**
4. Choose **JSON** format
5. Download the file
6. **IMPORTANT**: Rename it to `google-vision-key.json`
7. **IMPORTANT**: Move it to your project root: `/Users/chuck/Projects/snap2invoice/`

### 5. Test Connection
```bash
npm run dev
```

Upload a receipt - you should see "Google Vision successful!" in the console.

## Free Tier Limits
- ✅ **1,000 requests/month** (plenty for development)
- ✅ **No credit card required**
- ✅ **No automatic charges**

## File Structure
```
snap2invoice/
├── src/
├── google-vision-key.json    ← Place your downloaded JSON key here
└── package.json
```

## Security Note
- The `google-vision-key.json` file is already in `.gitignore`
- Never commit this file to version control
- For production, use environment variables instead

## Troubleshooting

**"Google Vision not available"**: 
- Check that `google-vision-key.json` is in the project root
- Verify the Vision API is enabled in Google Cloud Console

**"Authentication error"**: 
- Re-download the service account key
- Make sure it's named exactly `google-vision-key.json`

## Benefits Over Tesseract
- 🎯 **10x more accurate** for receipts
- ⚡ **Faster processing** (cloud-based)
- 🏗️ **Better text structure** preservation
- 📊 **Higher confidence scores**