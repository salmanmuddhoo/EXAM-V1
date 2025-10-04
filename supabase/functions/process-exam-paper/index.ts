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
  const AI_PROMPT = `Extract and split all questions from this exam paper.

**CRITICAL INSTRUCTIONS:**
1. Return ONLY a JSON array - no other text
2. Keep "fullText" SHORT - just the first 100 characters of each question
3. Format: [{"questionNumber":"1","startPage":1,"endPage":1,"fullText":"Question 1: ...","hasSubParts":false}]

**IMPORTANT:** 
- Keep fullText under 100 characters (use "..." if truncated)
- Look for "Question 1", "Q1", "1.", "1)" patterns
- Include ALL questions you find
- If question spans pages, set endPage accordingly
- Start page numbers from 1

**Example output:**
[
  {"questionNumber":"1","startPage":1,"endPage":1,"fullText":"Question 1: Calculate the derivative...","hasSubParts":false},
  {"questionNumber":"2","startPage":2,"endPage":2,"fullText":"Question 2: (a) Explain (b) Provide...","hasSubParts":true}
]

Return ONLY the JSON array, nothing else.`;

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
    jsonText = jsonText.trim();

    console.log("📥 JSON length:", jsonText.length, "chars");
    console.log("📥 First 300 chars:", jsonText.substring(0, 300));
    console.log("📥 Last 300 chars:", jsonText.substring(jsonText.length - 300));

    let questions;
    try {
      questions = JSON.parse(jsonText);
      console.log(`✅ Successfully parsed ${questions.length} questions`);
    } catch (parseError) {
      console.error("❌ JSON parse error at position:", parseError.message);
      
      // Find where the error occurred
      const match = parseError.message.match(/position (\d+)/);
      if (match) {
        const pos = parseInt(match[1]);
        console.error("Context around error position:");
        console.error(jsonText.substring(Math.max(0, pos - 200), Math.min(jsonText.length, pos + 200)));
      }
      
      // Try to salvage partial JSON by finding the last complete object
      try {
        console.log("🔄 Attempting to salvage partial response...");
        
        // Find the last complete question object
        const lastCompleteMatch = jsonText.match(/\{[^}]*\}(?=\s*,|\s*\])/g);
        
        if (lastCompleteMatch && lastCompleteMatch.length > 0) {
          // Reconstruct array with complete objects only
          const salvaged = '[' + lastCompleteMatch.join(',') + ']';
          questions = JSON.parse(salvaged);
          console.log(`⚠️ Salvaged ${questions.length} complete questions from truncated response`);
        } else {
          throw parseError;
        }
      } catch (salvageError) {
        console.error("❌ Could not salvage response");
        throw new Error(`JSON parse failed at position ${match ? match[1] : 'unknown'}. The response may be too large or malformed.`);
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
    
    // Step 2: For each question, extract the full text from its pages
    console.log("📝 Extracting full text for each question...");
    
    const questionsWithFullText = await extractFullTextForQuestions(
      validQuestions,
      pageImages,
      geminiApiKey
    );
    
    return questionsWithFullText;

  } catch (error) {
    console.error("❌ AI extraction failed:", error);
    throw new Error(`AI extraction failed: ${error.message}`);
  }
}

/**
 * Extract full text for each question from their specific pages
 */
async function extractFullTextForQuestions(
  questions: any[],
  pageImages: Array<{ pageNumber: number; base64Image: string }>,
  geminiApiKey: string
) {
  console.log(`📝 Processing ${questions.length} questions to extract full text...`);
  
  const results = [];
  
  // Process in batches of 3 to avoid rate limits
  for (let i = 0; i < questions.length; i += 3) {
    const batch = questions.slice(i, i + 3);
    
    const batchPromises = batch.map(async (question) => {
      try {
        // Get the page images for this question
        const relevantPages = pageImages.filter(
          p => p.pageNumber >= question.startPage && p.pageNumber <= question.endPage
        );
        
        if (relevantPages.length === 0) {
          console.warn(`⚠️ No pages for question ${question.questionNumber}`);
          return { ...question, fullText: question.fullText || "" };
        }
        
        // For now, just use the preview text we already have
        // In production, you could do another Gemini call here to get complete text
        return question;
        
      } catch (error) {
        console.error(`Error processing question ${question.questionNumber}:`, error);
        return question;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches
    if (i + 3 < questions.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`✅ Processed full text for ${results.length} questions`);
  return results;
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