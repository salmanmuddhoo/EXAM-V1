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

    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    const pagesWithOCR: Array<{ pageNumber: number; ocrText: string; base64Image: string }> = [];

    // --- Step 1: OCR each page ---
    for (const page of pageImages) {
      try {
        const ocrResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${googleApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: page.base64Image },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
            }]
          }),
        });

        if (!ocrResponse.ok) continue;
        const ocrData = await ocrResponse.json();
        const text = ocrData.responses[0]?.fullTextAnnotation?.text || '';

        pagesWithOCR.push({ pageNumber: page.pageNumber, ocrText: text, base64Image: page.base64Image });
      } catch (error) {
        console.error(`OCR failed for page ${page.pageNumber}:`, error);
      }
    }

    console.log(`OCR finished. Got text for ${pagesWithOCR.length} pages`);

    // --- Step 2: Run regex detection ---
    let regexQuestions = detectAndGroupQuestions(pagesWithOCR);
    console.log(`Regex detected ${regexQuestions.length} questions`);

    // --- Step 3: Run Gemini extraction in parallel ---
    let geminiQuestions: any[] = [];
    if (geminiApiKey) {
      const combinedText = pagesWithOCR.map(p => p.ocrText).join("\n\n");

      try {
        const geminiResponse = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=" + geminiApiKey,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [{
                  text: `Extract all main exam questions from this exam paper.
Return JSON array like:
[{ "questionNumber": "1", "text": "full question text..." }, ...].

Text:\n${combinedText}`
                }]
              }]
            }),
          }
        );

        const geminiData = await geminiResponse.json();
        const rawOutput = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        geminiQuestions = JSON.parse(rawOutput);
        console.log(`Gemini extracted ${geminiQuestions.length} questions`);
      } catch (err) {
        console.error("Gemini extraction failed:", err);
      }
    }

    // --- Step 4: Merge regex + Gemini results ---
    const merged: any[] = [];
    const seen = new Set<string>();

    // Prefer regex first
    for (const q of regexQuestions) {
      if (!seen.has(q.questionNumber)) {
        merged.push(q);
        seen.add(q.questionNumber);
      }
    }

    // Fill missing ones with Gemini output
    for (let i = 0; i < geminiQuestions.length; i++) {
      const q = geminiQuestions[i];
      const num = q.questionNumber || (i + 1).toString();
      if (!seen.has(num)) {
        merged.push({
          questionNumber: num,
          pageNumbers: [],
          ocrTexts: [q.text],
        });
        seen.add(num);
      }
    }

    console.log(`Final merged questions: ${merged.length}`);

    // --- Step 5: Save to Supabase ---
    for (const question of merged) {
      const combinedOCR = question.ocrTexts.join("\n\n");
      await supabase.from('exam_questions').upsert({
        exam_paper_id: examPaperId,
        question_number: question.questionNumber,
        page_numbers: question.pageNumbers,
        ocr_text: combinedOCR,
      }, { onConflict: 'exam_paper_id,question_number' });
    }

    return new Response(
      JSON.stringify({
        success: true,
        examQuestionsCount: merged.length,
        regexCount: regexQuestions.length,
        geminiCount: geminiQuestions.length,
        message: "Processed with regex + Gemini merge",
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

// --- Regex helper ---
function detectAndGroupQuestions(pagesWithOCR: Array<{ pageNumber: number; ocrText: string }>) {
  const patterns = [
    /(?:^|\n)\s*(?:Question|Q\.?)\s*(\d+[a-z]?)\s*[\.:)]?/gim,
    /(?:^|\n)\s*(\d+[a-z]?)\s*[\.:)]\s*/gm,
  ];
  const groups: any[] = [];
  let current: any = null;

  for (const page of pagesWithOCR) {
    let detected: string | null = null;
    const firstLines = page.ocrText.split("\n").slice(0, 10).join("\n");

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(firstLines);
      if (match && match[1]) {
        detected = match[1].trim().toLowerCase();
        break;
      }
    }

    if (detected) {
      if (current) groups.push(current);
      current = { questionNumber: detected, pageNumbers: [page.pageNumber], ocrTexts: [page.ocrText] };
    } else if (current) {
      current.pageNumbers.push(page.pageNumber);
      current.ocrTexts.push(page.ocrText);
    } else {
      current = { questionNumber: "1", pageNumbers: [page.pageNumber], ocrTexts: [page.ocrText] };
    }
  }
  if (current) groups.push(current);
  return groups;
}
