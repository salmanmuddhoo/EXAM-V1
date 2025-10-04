# AI Chatbot System - Technical Guide

This guide explains the enhanced AI chatbot system that analyzes exam papers and marking schemes to provide structured, educational responses.

## Overview

The AI chatbot system:
1. **Converts PDFs to images** for AI processing
2. **Analyzes both exam papers AND marking schemes**
3. **Provides structured responses** in 4 sections
4. **Supports multiple AI providers** (Gemini, OpenAI, Claude)
5. **Tailored for O-Level students** (ages 14-16)

## Architecture

### Frontend (ExamViewer.tsx)

**PDF Processing Flow:**
1. Downloads exam paper PDF from Supabase Storage
2. Converts PDF to Base64-encoded JPEG images using pdf.js
3. Downloads marking scheme PDF (if available)
4. Converts marking scheme to Base64 images
5. Stores images in component state for AI requests

**User Experience:**
- Processing indicator shows when PDFs are being converted
- Chat header displays: "Ready with exam paper (X pages) and marking scheme (Y pages)"
- User can ask questions once processing is complete
- Images are sent with every chat request

### Backend (Edge Function)

**File Structure:**
```
supabase/functions/exam-assistant/
├── index.ts              # Main edge function
├── ai-providers.ts       # AI provider abstraction layer
└── pdf-processor.ts      # PDF utility functions
```

**AI Provider Abstraction:**
- Single interface for all AI providers
- Easy to switch between Gemini, OpenAI, Claude
- Consistent request/response format
- Automatic API key management from environment variables

## Response Structure

The AI MUST provide responses in this exact format:

### 1. Explanation
Clear, conceptual explanation suitable for O-Level students:
- Break down complex ideas into simple terms
- Focus on fundamental concepts
- Use age-appropriate language

### 2. Examples
Practical, real-world examples:
- Relatable to everyday life
- Similar problems to illustrate concepts
- Common scenarios students understand

### 3. How to Get Full Marks
Specific examination strategies:
- Key points that must be included
- Common mistakes and how to avoid them
- Mark allocation guidance
- Time management tips
- Keywords/phrases examiners look for

### 4. Solution
Complete, step-by-step solution:
- Show all working clearly
- Explain each step of reasoning
- Use proper notation (mathematical/scientific)
- Present final answer clearly

## AI Providers

### Gemini (Default)

**Configuration:**
- Model: `gemini-2.0-flash-exp`
- Environment Variable: `GEMINI_API_KEY`
- Max Output: 2048 tokens
- Temperature: 0.7

**Benefits:**
- Latest Gemini 2.0 technology
- Improved reasoning and understanding
- Enhanced multimodal capabilities
- Faster response times
- Better at following structured output
- Cost-effective with generous free tier
- Handles multiple images well

### OpenAI (Optional)

**Configuration:**
- Model: `gpt-4o`
- Environment Variable: `OPENAI_API_KEY`
- Max Tokens: 2048

**Benefits:**
- Excellent reasoning
- Strong structured output
- High-quality explanations

### Claude (Optional)

**Configuration:**
- Model: `claude-3-5-sonnet-20241022`
- Environment Variable: `CLAUDE_API_KEY`
- Max Tokens: 2048

**Benefits:**
- Very detailed explanations
- Great at following structure
- Good educational responses

## How It Works

### Step 1: PDF Upload (Admin)
```
Admin uploads exam paper → Stored in Supabase Storage
Admin uploads marking scheme → Stored in Supabase Storage
```

### Step 2: Student Opens Exam
```
ExamViewer loads → Downloads PDFs from storage
PDFs converted to images using pdf.js
Images stored as Base64 strings in memory
Ready indicator shown to user
```

### Step 3: Student Asks Question
```
User types: "Explain question 1"
Frontend sends:
  - question: "Explain question 1"
  - examPaperImages: [base64...] (all pages)
  - markingSchemeImages: [base64...] (all pages)
  - provider: "gemini"
```

### Step 4: AI Processing
```
Edge function receives request
Gets AI provider (Gemini/OpenAI/Claude)
Constructs prompt with system instructions
Sends images with question to AI
AI analyzes both exam paper and marking scheme
AI generates structured response
```

### Step 5: Response Display
```
AI response returned to frontend
Displayed in chat with proper formatting
User can ask follow-up questions
Each request includes full PDF context
```

## Key Features

### 1. Full Document Context
Every AI request includes:
- **All pages** of the exam paper
- **All pages** of the marking scheme (if available)
- This allows AI to reference any question or section

### 2. Marking Scheme Analysis
The AI can:
- See the official marking criteria
- Understand mark allocation
- Identify key answer points
- Provide examiner-approved tips

### 3. Structured Responses
Enforced through:
- Detailed system prompt
- Clear section headers
- Consistent formatting
- Educational focus

### 4. O-Level Focused
Tailored for students aged 14-16:
- Age-appropriate language
- Curriculum-aligned explanations
- Examination-focused tips
- Encouraging tone

## Switching AI Providers

To change the AI provider, update the frontend request:

```typescript
// Use Gemini (default)
body: JSON.stringify({
  question: userMessage,
  examPaperImages: examPaperImages,
  markingSchemeImages: markingSchemeImages,
  provider: 'gemini',
})

// Use OpenAI
provider: 'openai'

// Use Claude
provider: 'claude'
```

## Environment Variables Required

Set these in Supabase Dashboard → Edge Functions → Secrets:

```bash
# Required (one of these):
GEMINI_API_KEY=your_gemini_key

# Optional (for alternative providers):
OPENAI_API_KEY=your_openai_key
CLAUDE_API_KEY=your_claude_key
```

## Performance Considerations

### PDF Processing Time
- **Small PDFs (1-3 pages)**: ~1-2 seconds
- **Medium PDFs (4-10 pages)**: ~3-5 seconds
- **Large PDFs (10+ pages)**: ~5-10 seconds

### AI Response Time
- **Gemini**: ~2-5 seconds
- **OpenAI**: ~3-8 seconds
- **Claude**: ~4-10 seconds

### Total User Experience
Processing PDFs: 2-5 seconds (one-time on page load)
AI Response: 2-10 seconds per message

## Image Quality Settings

Configured in `pdfUtils.ts`:

```typescript
const viewport = page.getViewport({ scale: 2.0 });  // 2x scale for clarity
canvas.toDataURL('image/jpeg', 0.85);  // 85% JPEG quality
```

**Trade-offs:**
- Higher scale = better quality, larger payload, slower processing
- Lower quality = smaller payload, faster transmission, reduced accuracy
- Current settings optimized for balance

## Error Handling

### PDF Processing Errors
- Graceful fallback to direct URL display
- User notified if processing fails
- Can still view PDF, just can't chat with AI

### AI Request Errors
- Clear error messages displayed in chat
- "Please try again" guidance
- Maintains conversation history

### Missing Marking Scheme
- AI still functions with exam paper only
- Notifies user that marking scheme is unavailable
- Response quality slightly reduced but still useful

## Best Practices

### For Students:
1. **Be specific** in questions: "Explain question 3 part (b)" instead of "Help"
2. **Reference question numbers** so AI knows where to look
3. **Ask follow-ups** to deepen understanding
4. **Use the structured response** sections to guide learning

### For Admins:
1. **Always upload marking schemes** for best AI responses
2. **Use clear, readable PDFs** (avoid low-quality scans)
3. **Test with sample questions** before making papers public
4. **Name papers descriptively** for easy student navigation

## Future Enhancements

Potential improvements:
- **Page-specific queries**: "Analyze only page 3"
- **Question extraction**: Auto-detect and list all questions
- **Progress tracking**: Save conversation history per paper
- **Difficulty adjustment**: Adapt explanation complexity
- **Multi-language support**: Translate questions and answers
- **Voice input**: Speak questions instead of typing
- **Diagram analysis**: Enhanced image understanding for graphs/charts

## Troubleshooting

### "Please wait for exam paper to finish processing"
- PDFs are still being converted to images
- Wait 2-5 seconds and try again
- Check browser console for conversion errors

### "Failed to get response from AI"
- Check GEMINI_API_KEY is configured
- Verify API key is valid and has quota
- Try switching to another provider

### Images not loading
- Check Supabase Storage permissions
- Verify PDF files exist in storage buckets
- Ensure RLS policies allow downloads

### Slow responses
- Large PDFs take longer to process
- Consider reducing PDF page count
- Check network connection speed

## API Cost Estimation

### Gemini (Free Tier)
- 15 requests per minute
- 1,500 requests per day
- Free for reasonable usage

### OpenAI
- ~$0.01-0.03 per request (with images)
- Depends on total image size + response length

### Claude
- ~$0.015-0.04 per request
- Depends on image count + output length

**Recommendation**: Use Gemini for production due to generous free tier and good performance.
