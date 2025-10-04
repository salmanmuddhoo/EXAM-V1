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
  pageImages: Array<{ pageNumber: number; base64Image: string }>;
}

interface QuestionData {
  questionNumber: string;
  startPage: number;
  endPage: number;
  questionText: string;
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
      return new Response(JSON.stringify({ error: 'Missing required fields: examPaperId and pageImages' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    console.log(`Processing ${pageImages.length} pages with Gemini 2.0 Flash`);

    // Step 1: Analyze all pages with Gemini to extract question structure
    const questions = await analyzeExamPaperWithGemini(pageImages, geminiApiKey);
    
    console.log(`Gemini detected ${questions.length} questions`);

    if (questions.length === 0) {
      throw new Error("No questions detected by Gemini. Please check the exam paper format.");
    }

    // Step 2: Extract individual question images and upload to storage
    const processedQuestions = await processQuestionImages(
      questions,
      pageImages,
      supabase,
      examPaperId
    );

    // Step 3: Save to database
    for (const question of processedQuestions) {
      await supabase.from('exam_questions').upsert({
        exam_paper_id: examPaperId,
        question_number: question.questionNumber,
        page_numbers: question.pageNumbers,
        ocr_text: question.questionText,
        image_url: question.imageUrl,
      }, { onConflict: 'exam_paper_id,question_number' });
    }

    console.log(`Successfully saved ${processedQuestions.length} questions`);

    return new Response(
      JSON.stringify({
        success: true,
        questionsCount: processedQuestions.length,
        questions: processedQuestions.map(q => ({
          number: q.questionNumber,
          pages: q.pageNumbers,
          hasImage: !!q.imageUrl
        })),
        message: "Exam paper processed successfully with Gemini 2.0 Flash",
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
 * Use Gemini 2.0 Flash to analyze the entire exam paper and extract all questions
 */
async function analyzeExamPaperWithGemini(
  pageImages: Array<{ pageNumber: number; base64Image: string }>,
  geminiApiKey: string
): Promise<QuestionData[]> {
  
  // Prepare all page images for Gemini
  const imageParts = pageImages.map(page => ({
    inline_data: {
      mime_type: "image/jpeg",
      data: page.base64Image
    }
  }));

  const prompt = `You are analyzing an exam paper. Your task is to identify ALL questions in this exam.

For each question you find, provide:
1. The question number (e.g., "1", "2", "3a", "4b", etc.)
2. The page number where it STARTS
3. The page number where it ENDS (if it spans multiple pages)
4. The complete question text (including all parts and sub-questions)

IMPORTANT:
- Look for typical question indicators: "Question 1", "Q1", "1.", "1)", etc.
- Some questions may span multiple pages
- Include sub-questions (like 1a, 1b) as separate entries OR group them under the main question (your choice based on structure)
- Page numbers start from 1

Return your response as a valid JSON array in this EXACT format:
[
  {
    "questionNumber": "1",
    "startPage": 1,
    "endPage": 2,
    "questionText": "Complete text of question 1..."
  },
  {
    "questionNumber": "2",
    "startPage": 3,
    "endPage": 3,
    "questionText": "Complete text of question 2..."
  }
]

Return ONLY the JSON array, no markdown formatting, no explanation, no additional text.`;

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
            maxOutputTokens: 8192,
            responseMimeType: "application/json"
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      throw new Error(`Gemini API failed: ${response.status}`);
    }

    const data = await response.json();
    const rawOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    
    console.log("Gemini raw output:", rawOutput);
    
    // Parse JSON response
    let questions: QuestionData[];
    try {
      // Remove markdown code blocks if present
      const cleanedOutput = rawOutput.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      questions = JSON.parse(cleanedOutput);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", rawOutput);
      throw new Error("Invalid JSON response from Gemini");
    }

    // Validate and clean up the questions
    const validQuestions = questions.filter(q => 
      q.questionNumber && 
      q.startPage && 
      q.endPage &&
      q.startPage <= q.endPage
    );

    if (validQuestions.length === 0) {
      console.warn("No valid questions found in Gemini response");
    }

    return validQuestions;

  } catch (error) {
    console.error("Gemini analysis failed:", error);
    throw error;
  }
}

/**
 * Extract individual question images and upload to Supabase Storage
 */
async function processQuestionImages(
  questions: QuestionData[],
  pageImages: Array<{ pageNumber: number; base64Image: string }>,
  supabase: any,
  examPaperId: string
): Promise<Array<{
  questionNumber: string;
  pageNumbers: number[];
  questionText: string;
  imageUrl: string;
}>> {
  
  const results = [];

  for (const question of questions) {
    try {
      // Get all pages for this question
      const relevantPages = pageImages.filter(
        p => p.pageNumber >= question.startPage && p.pageNumber <= question.endPage
      );

      if (relevantPages.length === 0) {
        console.warn(`No pages found for question ${question.questionNumber}`);
        continue;
      }

      // For single-page questions, use the page directly
      // For multi-page questions, use the first page as representative
      // (In production, you might want to stitch images together)
      const questionImage = relevantPages[0].base64Image;
      const pageNumbers = relevantPages.map(p => p.pageNumber);

      // Upload to Supabase Storage
      const fileName = `${examPaperId}/q_${question.questionNumber.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
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
      } else {
        console.error(`Upload failed for question ${question.questionNumber}:`, uploadError);
      }

      results.push({
        questionNumber: question.questionNumber,
        pageNumbers: pageNumbers,
        questionText: question.questionText,
        imageUrl: imageUrl,
      });

      console.log(`Processed question ${question.questionNumber}: pages ${pageNumbers.join(', ')}`);

    } catch (error) {
      console.error(`Error processing question ${question.questionNumber}:`, error);
    }
  }

  return results;
}