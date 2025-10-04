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
  const AI_PROMPT = `You are an expert exam paper analyzer. Extract and split all questions from this exam paper.

**CRITICAL: You MUST respond with ONLY a valid JSON array. No explanations, no markdown, no text before or after.**

Identify every question and return a JSON array like this:
[
  {
    "questionNumber": "1",
    "startPage": 1,
    "endPage": 1,
    "fullText": "Complete question text here...",
    "hasSubParts": false
  },
  {
    "questionNumber": "2", 
    "startPage": 2,
    "endPage": 3,
    "fullText": "Complete question text including all parts...",
    "hasSubParts": true
  }
]

**RULES:**
1. Look for "Question 1", "Q1", "1.", "1)", or similar patterns
2. Include ALL text belonging to each question
3. If a question spans multiple pages, set endPage accordingly
4. Page numbers start from 1
5. Extract EVERY question - don't skip any
6. Return ONLY the JSON array - nothing else

**YOUR RESPONSE MUST START WITH [ AND END WITH ]**`;

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
            temperature: 0.1,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 16384,
            responseMimeType: "application/json",
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
    
    console.log("📦 Full Gemini API response:", JSON.stringify(data, null, 2));
    
    // Extract the text response
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) {
      console.error("❌ No text in response!");
      console.error("Full data:", JSON.stringify(data, null, 2));
      throw new Error("Empty response from Gemini");
    }
    
    // Check if response was truncated
    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      console.warn(`⚠️ Response may be incomplete. Finish reason: ${finishReason}`);
    }

    console.log("📥 Raw Gemini response length:", rawText.length);
    console.log("📥 Response preview:", rawText.substring(0, 500));

    // Parse JSON from response (handle multiple formats)
    let jsonText = rawText.trim();
    
    // Try to extract JSON from markdown code blocks
    if (jsonText.includes('```')) {
      const match = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match) {
        jsonText = match[1].trim();
      }
    }
    
    // Try to find JSON array in the text
    if (!jsonText.startsWith('[')) {
      const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonText = arrayMatch[0];
      }
    }

    // Clean up the JSON text - fix common issues
    // Replace unicode characters that might cause issues
    jsonText = jsonText
      .replace(/\\n/g, ' ')  // Replace escaped newlines with spaces
      .replace(/\n/g, ' ')   // Replace actual newlines with spaces
      .replace(/\s+/g, ' ')  // Collapse multiple spaces
      .trim();

    console.log("📥 Cleaned JSON preview:", jsonText.substring(0, 500));

    let questions;
    try {
      questions = JSON.parse(jsonText);
      console.log(`✅ Successfully parsed ${questions.length} questions`);
    } catch (parseError) {
      console.error("❌ JSON parse error!");
      console.error("Parse error message:", parseError.message);
      console.error("Problematic JSON (first 2000 chars):", jsonText.substring(0, 2000));
      
      // Try one more time with a more aggressive clean
      try {
        const cleanedAgain = jsonText
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
          .replace(/\\"/g, '"')  // Fix escaped quotes
          .replace(/\\/g, '');   // Remove remaining backslashes
        
        questions = JSON.parse(cleanedAgain);
        console.log(`✅ Parsed after aggressive cleaning: ${questions.length} questions`);
      } catch (secondError) {
        console.error("❌ Second parse attempt also failed");
        throw new Error(`Failed to parse Gemini response. Error: ${parseError.message}`);
      }
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