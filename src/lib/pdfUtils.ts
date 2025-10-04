declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export interface PdfImagePart {
  inlineData: {
    data: string;
    mimeType: 'image/jpeg';
  };
}

export async function convertPdfToBase64Images(file: File): Promise<PdfImagePart[]> {
  if (!window.pdfjsLib) {
    throw new Error('pdf.js library not loaded');
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const imageParts: PdfImagePart[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Failed to get canvas context');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    const base64Image = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    imageParts.push({
      inlineData: {
        data: base64Image,
        mimeType: 'image/jpeg',
      },
    });
  }

  return imageParts;
}

export function createPdfPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function revokePdfPreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}
