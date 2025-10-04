# PDF Upload and Processing Guide

This guide explains how the PDF upload functionality works in the application, including both user preview and AI processing.

## Overview

When a user uploads a PDF file in the Exam Paper Manager:

1. **User Preview**: The PDF is displayed directly in the UI using an `<embed>` tag
2. **AI Processing**: The PDF is converted to Base64-encoded JPEG images for the Gemini API

## Implementation Details

### 1. PDF.js Library

The application uses Mozilla's pdf.js library loaded from a CDN:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
```

The worker is configured in the utility functions:
```javascript
window.pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
```

### 2. User Preview with `<embed>` Tag

When a PDF is selected, a temporary URL is created:

```typescript
const previewUrl = URL.createObjectURL(file);
```

This URL is then used in an `<embed>` tag:

```jsx
<embed
  src={previewUrl}
  type="application/pdf"
  className="w-full h-96"
/>
```

The embed tag provides a native, scrollable PDF viewer directly in the browser.

### 3. PDF to Base64 Images Conversion

The `convertPdfToBase64Images()` function handles the conversion:

**Process:**
1. Load the PDF file as an ArrayBuffer
2. Use pdf.js to parse the PDF document
3. For each page:
   - Render the page to a canvas at 2x scale (for quality)
   - Convert the canvas to a JPEG image
   - Extract the Base64 string
   - Format it for the Gemini API

**Output Format:**
```typescript
{
  inlineData: {
    data: "base64StringHere",
    mimeType: "image/jpeg"
  }
}
```

### 4. Using with Gemini API

The converted images can be sent to the Gemini API:

```typescript
import { sendPdfToGemini } from './lib/geminiExample';

const answer = await sendPdfToGemini(
  "Explain question 1",
  pdfImages,
  geminiApiKey
);
```

The API request structure:
```json
{
  "contents": [
    {
      "parts": [
        { "text": "Your question here" },
        { "inlineData": { "data": "base64...", "mimeType": "image/jpeg" } },
        { "inlineData": { "data": "base64...", "mimeType": "image/jpeg" } }
      ]
    }
  ]
}
```

## Code Structure

### Files Created/Modified:

1. **`src/lib/pdfUtils.ts`** - Core PDF processing utilities
   - `convertPdfToBase64Images()` - Converts PDF to Base64 images
   - `createPdfPreviewUrl()` - Creates blob URL for preview
   - `revokePdfPreviewUrl()` - Cleans up blob URLs

2. **`src/lib/geminiExample.ts`** - Example Gemini API integration
   - `sendPdfToGemini()` - Sends PDF images with question to Gemini

3. **`src/components/ExamPaperManager.tsx`** - Updated upload UI
   - PDF file selection with preview
   - Background PDF processing
   - Progress indicators

4. **`index.html`** - Added pdf.js library from CDN

## User Experience Flow

1. **Upload PDF**:
   - User clicks on the upload area
   - Selects a PDF file from their device

2. **Immediate Preview**:
   - PDF preview appears in an embed viewer
   - User can scroll through the PDF

3. **Background Processing**:
   - Processing indicator shows "Processing PDF for AI..."
   - Each page is converted to a JPEG image
   - Success message shows number of pages processed

4. **Submit**:
   - User fills in other form fields
   - Clicks "Upload Exam Paper"
   - PDF is uploaded to Supabase Storage
   - Metadata is saved to the database

## Key Features

✅ **Native PDF Preview** - Uses browser's built-in PDF viewer
✅ **No External Libraries for Preview** - Pure HTML embed tag
✅ **High Quality Conversion** - 2x scale rendering for clarity
✅ **Concurrent Processing** - Preview and conversion happen simultaneously
✅ **Memory Management** - Blob URLs are properly cleaned up
✅ **Progress Indicators** - User knows what's happening
✅ **Error Handling** - Graceful fallbacks if processing fails

## Performance Considerations

- **Scale Factor**: Set to 2.0 for good quality without massive file sizes
- **JPEG Quality**: Set to 0.85 (85%) for balance between quality and size
- **Processing Time**: Approximately 0.5-1 second per page
- **Memory Usage**: Canvas created and destroyed for each page

## Limitations

- PDF must be less than 50MB (Supabase storage limit)
- Processing time increases with page count
- Very large PDFs may cause memory issues in the browser
- Complex PDFs with many images may take longer to process

## Future Enhancements

Potential improvements:
- Add pagination controls to PDF preview
- Show processing progress per page
- Cache converted images to avoid reprocessing
- Support for other document formats (Word, PowerPoint)
- Compress images further if needed for API limits
