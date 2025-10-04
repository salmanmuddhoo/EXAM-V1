import { PdfImagePart } from './pdfUtils';

export async function sendPdfToGemini(
  question: string,
  pdfImages: PdfImagePart[],
  geminiApiKey: string
): Promise<string> {
  const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  const requestBody = {
    contents: [
      {
        parts: [
          { text: question },
          ...pdfImages,
        ],
      },
    ],
  };

  const response = await fetch(`${apiUrl}?key=${geminiApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}
