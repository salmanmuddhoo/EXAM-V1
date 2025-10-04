export interface OCRResult {
  text: string;
  confidence: number;
}

export class GoogleCloudVisionOCR {
  private apiKey: string;
  private endpoint = 'https://vision.googleapis.com/v1/images:annotate';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async extractTextFromImage(base64Image: string): Promise<OCRResult> {
    try {
      const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Image,
              },
              features: [
                {
                  type: 'DOCUMENT_TEXT_DETECTION',
                  maxResults: 1,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google Cloud Vision API error: ${error}`);
      }

      const data = await response.json();

      if (!data.responses || data.responses.length === 0) {
        return { text: '', confidence: 0 };
      }

      const result = data.responses[0];

      if (result.error) {
        throw new Error(`OCR error: ${result.error.message}`);
      }

      const fullTextAnnotation = result.fullTextAnnotation;

      if (!fullTextAnnotation) {
        return { text: '', confidence: 0 };
      }

      const text = fullTextAnnotation.text || '';
      const confidence = this.calculateAverageConfidence(fullTextAnnotation.pages || []);

      return { text, confidence };
    } catch (error) {
      console.error('OCR extraction error:', error);
      throw error;
    }
  }

  private calculateAverageConfidence(pages: any[]): number {
    if (pages.length === 0) return 0;

    let totalConfidence = 0;
    let count = 0;

    for (const page of pages) {
      if (page.confidence !== undefined) {
        totalConfidence += page.confidence;
        count++;
      }
    }

    return count > 0 ? totalConfidence / count : 0;
  }
}

export function createOCRService(): GoogleCloudVisionOCR {
  const apiKey = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY');

  if (!apiKey) {
    throw new Error('GOOGLE_CLOUD_VISION_API_KEY environment variable is not set');
  }

  return new GoogleCloudVisionOCR(apiKey);
}
