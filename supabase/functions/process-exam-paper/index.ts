import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProcessRequest {
  examPaperId: string;
  examPaperPath: string;
  markingSchemeId?: string;
  markingSchemePath?: string;
  pageImages: Array<{ pageNumber: number; base64Image: string }>;
  markingSchemeImages?: Array<{ pageNumber: number; base64Image: string }>;
}

interface QuestionBoundary {
  questionNumber: string;
  startPage: number;
  endPage: number;
  startY?: number;
  endY?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      examPaperId,
      pageImages,
      markingSchemeImages = []
    }: ProcessRequest = await req.json();

    if (!examPaperId || !pageImages || pageImages.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields: examPaperId and pageImages' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // --- Step 1: Use Gemini Vision to detect question boundaries ---
    const questionBoundaries = await detectQuestionBoundariesWithVision(
      pageImages,
      geminiApiKey
    );

    console.log(`Detected ${questionBoundaries.length} question boundaries`);

    // --- Step 2: Extract individual question images ---
    const questionImages = await extractQuestionImages(
      pageImages,
      questionBoundaries,
      supabase,
      examPaperId
    );

    console.log(`Extracted ${questionImages.length} question images`);

    // --- Step 3: Extract text for each question using Gemini ---
    const questionsWithText = await extractQuestionTexts(
      questionImages,
      geminiApiKey
    );

    // --- Step 4: Save to Supabase ---
    for (const question of questionsWithText) {
      await supabase.from('exam_questions').upsert({
        exam_paper_id: examPaperId,
        question_number: question.questionNumber,
        page_numbers: question.pageNumbers,
        ocr_text: question.text,
        image_url: question.imageUrl, // Store the cropped question image URL
        image_base64: question.imageBase64, // Optional: store base64 if preferred
      }, { onConflict: 'exam_paper_id,question_number' });
    }

    return new Response(
      JSON.stringify({
        success: true,
        questionsCount: questionsWithText.length,
        message: "Questions extracted and stored with individual images",
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in process-exam-paper:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process exam paper", details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Use Gemini Vision to analyze the exam paper structure and detect question boundaries
 */
async function detectQuestionBoundariesWithVision(
  pageImages: Array<{ pageNumber: number; base64Image: string }>,
  geminiApiKey: string
): Promise<QuestionBoundary[]> {
  
  // Process first few pages to detect structure (most exams have questions on first pages)
  const samplesToAnalyze = pageImages.slice(0, Math.min(3, pageImages.length));
  
  const imageParts = samplesToAnalyze.map(page => ({
    inline_data: {
      mime_type: "image/jpeg",
      data: page.base64Image
    }
  }));

  const prompt = `Analyze this exam paper and identify all question boundaries.
For each question, provide:
- Question number (e.g., "1", "2a", "3")
- Which page it starts on
- Which page it ends on

Return ONLY a JSON array in this exact format:
[
  {"questionNumber": "1", "startPage": 1, "endPage": 1},
  {"questionNumber": "2", "startPage": 2, "endPage": 3},
  ...
]

Rules:
- Look for question numbers like "Question 1", "Q1", "1.", "1)", etc.
- Each question may span multiple pages
- Sub-questions (1a, 1b) should be grouped under main question
- Return valid JSON only, no markdown or explanation`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: prompt }, ...imageParts]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          }
        }),
      }
    );

    const data = await response.json();
    const rawOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    
    // Clean markdown formatting if present
    const jsonMatch = rawOutput.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawOutput;
    
    const boundaries: QuestionBoundary[] = JSON.parse(jsonStr);
    
    // If detection failed or got incomplete results, fallback to simple page-per-question
    if (boundaries.length === 0) {
      console.warn("Vision detection failed, using fallback: one question per page");
      return pageImages.map((page, idx) => ({
        questionNumber: (idx + 1).toString(),
        startPage: page.pageNumber,
        endPage: page.pageNumber,
      }));
    }
    
    return boundaries;
  } catch (error) {
    console.error("Vision detection failed:", error);
    // Fallback: assume one question per page
    return pageImages.map((page, idx) => ({
      questionNumber: (idx + 1).toString(),
      startPage: page.pageNumber,
      endPage: page.pageNumber,
    }));
  }
}

/**
 * Extract individual question images and upload to storage
 */
async function extractQuestionImages(
  pageImages: Array<{ pageNumber: number; base64Image: string }>,
  boundaries: QuestionBoundary[],
  supabase: any,
  examPaperId: string
): Promise<Array<{
  questionNumber: string;
  pageNumbers: number[];
  imageBase64: string;
  imageUrl: string;
}>> {
  
  const results = [];

  for (const boundary of boundaries) {
    const relevantPages = pageImages.filter(
      p => p.pageNumber >= boundary.startPage && p.pageNumber <= boundary.endPage
    );

    if (relevantPages.length === 0) continue;

    // For single-page questions, use the page image directly
    // For multi-page questions, we'll concatenate them vertically (simplified approach)
    let questionImage: string;
    
    if (relevantPages.length === 1) {
      questionImage = relevantPages[0].base64Image;
    } else {
      // For multi-page questions, store first page as representative
      // In production, you'd want to stitch images together
      questionImage = relevantPages[0].base64Image;
      console.log(`Question ${boundary.questionNumber} spans multiple pages, using first page`);
    }

    // Upload to Supabase Storage
    const fileName = `${examPaperId}/question_${boundary.questionNumber}.jpg`;
    const imageBuffer = Uint8Array.from(atob(questionImage), c => c.charCodeAt(0));
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('exam-questions')
      .upload(fileName, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    let imageUrl = '';
    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage
        .from('exam-questions')
        .getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    }

    results.push({
      questionNumber: boundary.questionNumber,
      pageNumbers: relevantPages.map(p => p.pageNumber),
      imageBase64: questionImage,
      imageUrl: imageUrl,
    });
  }

  return results;
}

/**
 * Extract question text using Gemini Vision on individual question images
 */
async function extractQuestionTexts(
  questionImages: Array<{
    questionNumber: string;
    pageNumbers: number[];
    imageBase64: string;
    imageUrl: string;
  }>,
  geminiApiKey: string
): Promise<Array<{
  questionNumber: string;
  pageNumbers: number[];
  text: string;
  imageUrl: string;
  imageBase64: string;
}>> {
  
  const results = [];

  // Process in batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < questionImages.length; i += batchSize) {
    const batch = questionImages.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (question) => {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [
                  { text: "Extract the complete text of this exam question. Include the question number, all parts, and any instructions. Return only the question text, no additional commentary." },
                  {
                    inline_data: {
                      mime_type: "image/jpeg",
                      data: question.imageBase64
                    }
                  }
                ]
              }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 2048,
              }
            }),
          }
        );

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return {
          questionNumber: question.questionNumber,
          pageNumbers: question.pageNumbers,
          text: text,
          imageUrl: question.imageUrl,
          imageBase64: question.imageBase64,
        };
      } catch (error) {
        console.error(`Failed to extract text for question ${question.questionNumber}:`, error);
        return {
          questionNumber: question.questionNumber,
          pageNumbers: question.pageNumbers,
          text: '',
          imageUrl: question.imageUrl,
          imageBase64: question.imageBase64,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches to respect rate limits
    if (i + batchSize < questionImages.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}