import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProcessRequest {
  examPaperId: string;
  pageImages: Array<{ pageNumber: number; base64Image: string }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { examPaperId, pageImages }: ProcessRequest = await req.json();

    if (!examPaperId || !pageImages || pageImages.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    console.log(`🔍 Analyzing ${pageImages.length} pages with Gemini...`);

    // ============================================
    // STEP 1: Extract and split all questions using Gemini AI
    // ============================================
    const questions = await extractAndSplitQuestions(pageImages, geminiApiKey);
    
    console.log(`✅ Extracted ${questions.length} questions`);

    if (questions.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No questions detected", 
          details: "Gemini could not identify any questions in the exam paper"
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // STEP 2: Store individual question images
    // ============================================
    const savedQuestions = await saveQuestionImages(
      questions,
      pageImages,
      supabase,
      examPaperId
    );

    // ============================================
    // STEP 3: Save to database
    // ============================================
    for (const q of savedQuestions) {
      await supabase.from('exam_questions').upsert({
        exam_paper_id: examPaperId,
        question_number: q.questionNumber,
        page_numbers: q.pageNumbers,
        ocr_text: q.fullText,
        image_url: q.imageUrl,
      }, { onConflict: 'exam_paper_id,question_number' });
    }

    return new Response(
      JSON.stringify({
        success: true,
        questionsCount: savedQuestions.length,
        questions: savedQuestions.map(q => ({
          number: q.questionNumber,
          pages: q.pageNumbers,
          preview: q.fullText.substring(0, 100) + '...'
        }))
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * 🤖 AI PROMPT: Extract and split all questions from exam paper
 */
async function extractAndSplitQuestions(
  pageImages: Array<{ pageNumber: number; base64Image: string }>,
  geminiApiKey: string
) {
  
  const imageParts = pageImages.map(page => ({
    inline_data: {
      mime_type: "image/jpeg",
      data: page.base64Image
    }
  }));

  // ============================================
  // 🎯 THE AI PROMPT - CUSTOMIZE THIS
  // ============================================
  const AI_PROMPT = `You are an expert exam paper analyzer. Your job is to extract and split all questions from this exam paper.

📋 TASK: Identify every single question in this exam paper and provide detailed information about each one.

🔍 WHAT TO LOOK FOR:
- Questions marked as "Question 1", "Q1", "1.", "1)", or similar patterns
- Questions with sub-parts like "1(a)", "1a", "Question 1 part a"
- Questions that span multiple pages
- Instructions or context that belongs to a question

📦 OUTPUT FORMAT:
Return a JSON array where each question has:
- "questionNumber": The question identifier (e.g., "1", "2a", "3")
- "startPage": Page number where question begins (1-indexed)
- "endPage": Page number where question ends
- "fullText": Complete question text including all parts, sub-questions, and instructions
- "hasSubParts": true/false - does this question have multiple parts?

🎯 EXAMPLE OUTPUT:
[
  {
    "questionNumber": "1",
    "startPage": 1,
    "endPage": 1,
    "fullText": "Question 1: Calculate the derivative of f(x) = x^2 + 3x + 2",
    "hasSubParts": false
  },
  {
    "questionNumber": "2",
    "startPage": 2,
    "endPage": 3,
    "fullText": "Question 2: (a) Explain the concept of... (b) Provide an example of...",
    "hasSubParts": true
  }
]

⚠️ IMPORTANT RULES:
1. Extract EVERY question you find - don't skip any
2. If a question spans multiple pages, set endPage accordingly
3. Include the complete text - don't truncate or summarize
4. Return ONLY valid JSON - no markdown, no explanations
5. If you see page numbers in the images, use those; otherwise count from 1

BEGIN ANALYSIS NOW:`;

  try {
    console.log("📤 Sending to Gemini AI...");
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: AI_PROMPT },
              ...imageParts
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 8192,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      throw new Error(`Gemini API failed with status ${response.status}`);
    }

    const data = await response.json();
    
    // Extract the text response
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) {
      console.error("No response from Gemini:", JSON.stringify(data, null, 2));
      throw new Error("Empty response from Gemini");
    }

    console.log("📥 Raw Gemini response:", rawText.substring(0, 500));

    // Parse JSON from response (handle markdown code blocks)
    let jsonText = rawText.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      const match = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match) {
        jsonText = match[1].trim();
      }
    }

    let questions;
    try {
      questions = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("JSON parse error. Raw text:", jsonText);
      throw new Error("Failed to parse Gemini response as JSON");
    }

    // Validate structure
    if (!Array.isArray(questions)) {
      throw new Error("Gemini response is not an array");
    }

    // Filter and validate questions
    const validQuestions = questions.filter(q => {
      const isValid = q.questionNumber && 
                     typeof q.startPage === 'number' && 
                     typeof q.endPage === 'number' &&
                     q.fullText;
      
      if (!isValid) {
        console.warn("Invalid question detected:", q);
      }
      return isValid;
    });

    console.log(`✅ Successfully parsed ${validQuestions.length} valid questions`);
    
    return validQuestions;

  } catch (error) {
    console.error("❌ AI extraction failed:", error);
    throw new Error(`AI extraction failed: ${error.message}`);
  }
}

/**
 * Save individual question images to Supabase Storage
 */
async function saveQuestionImages(
  questions: any[],
  pageImages: Array<{ pageNumber: number; base64Image: string }>,
  supabase: any,
  examPaperId: string
) {
  
  const results = [];

  for (const question of questions) {
    try {
      // Find all pages for this question
      const relevantPages = pageImages.filter(
        p => p.pageNumber >= question.startPage && 
             p.pageNumber <= question.endPage
      );

      if (relevantPages.length === 0) {
        console.warn(`⚠️ No pages found for question ${question.questionNumber}`);
        continue;
      }

      // Use first page as representative image
      // TODO: For multi-page questions, consider stitching images together
      const questionImageBase64 = relevantPages[0].base64Image;
      
      // Clean question number for filename (remove special chars)
      const cleanQuestionNum = question.questionNumber.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${examPaperId}/question_${cleanQuestionNum}.jpg`;
      
      // Convert base64 to buffer
      const imageBuffer = Uint8Array.from(atob(questionImageBase64), c => c.charCodeAt(0));
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('exam-questions')
        .upload(fileName, imageBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.error(`Upload error for Q${question.questionNumber}:`, uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('exam-questions')
        .getPublicUrl(fileName);

      results.push({
        questionNumber: question.questionNumber,
        pageNumbers: relevantPages.map(p => p.pageNumber),
        fullText: question.fullText,
        imageUrl: urlData.publicUrl,
      });

      console.log(`✅ Saved question ${question.questionNumber}`);

    } catch (error) {
      console.error(`❌ Failed to save question ${question.questionNumber}:`, error);
    }
  }

  return results;
}