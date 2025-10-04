# Quick Deployment Guide - Edge Functions

## Current Status
✅ Frontend code updated and deployed
✅ Database migration file ready
⚠️ Edge Functions need to be deployed

## What You Need to Do

Your app is currently working in **fallback mode** - uploads work, but question optimization isn't active yet. To enable the cost optimization:

### Step 1: Apply Database Migration

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor**
4. Open the file: `supabase/migrations/20251003050000_create_question_based_storage.sql`
5. Copy all the SQL content
6. Paste into SQL Editor and click **Run**
7. Verify success - you should see "Success. No rows returned"

### Step 2: Set Up Google Cloud Vision API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select existing one
3. Enable **Cloud Vision API**:
   - Search for "Cloud Vision API" in the search bar
   - Click "Enable"
4. Create API Key:
   - Go to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **API Key**
   - Copy the key (starts with `AIza...`)

### Step 3: Add API Key to Supabase

1. In Supabase Dashboard, go to **Project Settings** > **Edge Functions**
2. Scroll to **Secrets**
3. Click **Add Secret**
4. Name: `GOOGLE_CLOUD_VISION_API_KEY`
5. Value: Paste your Google Cloud Vision API key
6. Click **Save**

### Step 4: Deploy Edge Functions

You have 2 options:

#### Option A: Using Supabase CLI (Recommended - Fastest)

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login
supabase login

# Link your project (get project ref from dashboard URL)
supabase link --project-ref your-project-ref-here

# Deploy both functions
supabase functions deploy process-exam-paper
supabase functions deploy exam-assistant
```

#### Option B: Using Supabase Dashboard (Manual)

**Deploy process-exam-paper:**

1. Go to **Edge Functions** in Supabase Dashboard
2. Click **Create a new function**
3. Function name: `process-exam-paper`
4. Copy content from each file and paste:
   - Main: `supabase/functions/process-exam-paper/index.ts`
   - Create additional files:
     - `ocr-service.ts`
     - `question-detector.ts`
     - `pdf-splitter.ts`
5. Click **Deploy**

**Update exam-assistant:**

1. Find existing `exam-assistant` function
2. Click **Edit**
3. Update `index.ts` with new content
4. Add new file: `question-retrieval.ts`
5. Click **Deploy**

### Step 5: Test the System

1. Go to your app as admin
2. Try uploading an exam paper
3. You should see "Processing PDF: Splitting pages and running OCR..."
4. After ~10-20 seconds, you should see: "Exam paper uploaded and processed successfully! Detected X questions."
5. Open the exam paper as a student
6. Ask "Question 1" in the chat
7. Check browser console - you should see:
   ```
   ✅ Used optimized question retrieval for Question 1
   📊 Images sent to AI: 2 (instead of 35)
   ```

## Current Behavior (Before Deployment)

Right now your app is working but without optimization:
- ✅ Admins can upload exam papers
- ✅ Students can chat with AI
- ⚠️ System uses full PDF mode (no cost optimization yet)
- ℹ️ You'll see message: "Question optimization not yet available"

## After Deployment

Once you deploy the Edge Functions:
- ✅ Automatic PDF processing during upload
- ✅ Question detection and grouping
- ✅ Smart question-based retrieval
- ✅ ~93% cost reduction
- ✅ Console logs showing optimization

## Troubleshooting

### "Processing function not available yet"
→ Edge Function not deployed. Complete Step 4.

### "GOOGLE_CLOUD_VISION_API_KEY not set"
→ API key not configured. Complete Steps 2 & 3.

### "Failed to split PDF"
→ Check Edge Function logs in Supabase Dashboard

### "Question not found in database"
→ Normal - will use fallback mode with full PDF

## Files Location

All code is ready in your project:

**Migration:**
- `supabase/migrations/20251003050000_create_question_based_storage.sql`

**Edge Functions:**
- `supabase/functions/process-exam-paper/` (4 files)
- `supabase/functions/exam-assistant/` (4 files)

**Documentation:**
- `DEPLOYMENT_INSTRUCTIONS.md` (detailed version)
- `OPTIMIZATION_GUIDE.md` (system documentation)

## Support

If you encounter issues:
1. Check Edge Function logs in Supabase Dashboard
2. Verify API key is correctly set
3. Review DEPLOYMENT_INSTRUCTIONS.md for detailed steps
4. Check browser console for specific error messages
