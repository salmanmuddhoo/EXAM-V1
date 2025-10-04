import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAIProvider, AIMessage } from './ai-providers.ts';
import { parseQuestionNumber, getQuestionImages } from './question-retrieval.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  question: string;
  examPaperImages?: string[];
  markingSchemeImages?: string[];
  examPaperId?: string;
  markingSchemeId?: string;
  provider?: string;
  optimizedMode?: boolean;
  questionNumber?: string;
  questionText?: string;
  questionImageUrl?: string;
}

const SYSTEM_PROMPT = `You are an expert O-Level educational AI assistant helping students understand exam questions.

You have access to both the exam paper and its marking scheme, but the marking scheme is **strictly for internal reference only**. You must NOT mention, quote, or reveal the marking scheme in any part of your answer. Treat the marking scheme as invisible to the student.

Your task is to answer the student's question with a structured response. CRITICAL: You MUST structure your response EXACTLY in this format with these four sections:

## Explanation
Provide a clear, conceptual explanation suitable for an O-Level student. Break down complex ideas into simple, understandable terms. Focus on the fundamental concepts. Do NOT copy from the marking scheme.

## Examples
Give practical, real-world examples or similar problems to illustrate the concept for students. Make it relatable to everyday life or common scenarios.

## How to Get Full Marks
Provide specific examination tips and strategies:
- Key points that must be included in the answer
- Common mistakes students make and how to avoid them
- Mark allocation guidance
- Specific keywords or phrases examiners look for
Do NOT reference the marking scheme.

## Solution
Provide a complete, step-by-step solution:
- Show all working clearly
- Explain each step of your reasoning
- Use proper mathematical/scientific notation
- Present the final answer clearly
- Do NOT mention the marking scheme anywhere

Keep your language appropriate for O-Level students (14-16 years old). Be encouraging and focus on building understanding, not just providing answers.
`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const {
      question,
      examPaperImages,
      markingSchemeImages,
      examPaperId,
      markingSchemeId,
      provider = 'gemini',
      optimizedMode = false,
      questionNumber: providedQuestionNumber,
      questionText,
      questionImageUrl
    }: RequestBody = await req.json();

    if (!question) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: question' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    let finalExamImages: string[] = [];
    let finalMarkingSchemeImages: string[] = [];
    let usedOptimizedMode = false;
    let detectedQuestionNumber: string | null = null;

    // Handle optimized mode (frontend already fetched the question image)
    if (optimizedMode && examPaperImages && examPaperImages.length > 0) {
      console.log(`Using OPTIMIZED mode for question ${providedQuestionNumber}`);
      console.log(`Received ${examPaperImages.length} pre-fetched image(s)`);
      
      finalExamImages = examPaperImages;
      finalMarkingSchemeImages = markingSchemeImages || [];
      usedOptimizedMode = true;
      detectedQuestionNumber = providedQuestionNumber || null;
    } 
    // Try automatic question detection and retrieval (legacy mode)
    else {
      const questionNumber = parseQuestionNumber(question);

      if (questionNumber && examPaperId) {
        console.log(`Detected question number: ${questionNumber}`);
        console.log(`Attempting to retrieve question-specific images from database`);

        const questionData = await getQuestionImages(examPaperId, questionNumber, markingSchemeId);

        if (questionData && questionData.examImages.length > 0) {
          console.log(`Found ${questionData.examImages.length} exam images for question ${questionNumber}`);
          console.log(`Found ${questionData.markingSchemeImages.length} marking scheme images`);
          finalExamImages = questionData.examImages;
          finalMarkingSchemeImages = questionData.markingSchemeImages;
          usedOptimizedMode = true;
          detectedQuestionNumber = questionNumber;
        } else {
          console.log(`Question ${questionNumber} not found in database, falling back to full PDF`);
        }
      }
    }

    // Fallback to full PDF mode
    if (!usedOptimizedMode) {
      if (!examPaperImages || examPaperImages.length === 0) {
        return new Response(
          JSON.stringify({ 
            error: 'No exam paper images available. Please provide examPaperImages or ensure the paper has been processed.' 
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      console.log(`Using FALLBACK mode: ${examPaperImages.length} exam images + ${(markingSchemeImages || []).length} marking scheme images`);
      finalExamImages = examPaperImages;
      finalMarkingSchemeImages = markingSchemeImages || [];
    }

    const aiProvider = getAIProvider(provider);

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `Student's Question: ${question}\n\nPlease analyze the exam paper${finalMarkingSchemeImages.length > 0 ? ' and marking scheme' : ''} provided below and answer following the four-section structure.`,
      },
    ];

    console.log(`Sending to AI: ${finalExamImages.length} exam images + ${finalMarkingSchemeImages.length} marking scheme images`);

    const response = await aiProvider.generateResponse(
      messages,
      finalExamImages,
      finalMarkingSchemeImages
    );

    return new Response(
      JSON.stringify({
        answer: response.content,
        model: response.model,
        provider: response.provider,
        optimized: usedOptimizedMode,
        questionNumber: detectedQuestionNumber,
        imagesUsed: finalExamImages.length + finalMarkingSchemeImages.length,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in exam-assistant function:', error);
    return new Response(
      JSON.stringify({
        error: 'An error occurred while processing your request',
        details: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});