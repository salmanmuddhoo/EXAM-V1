export interface PageImage {
  pageNumber: number;
  base64Image: string;
  mimeType: string;
}

export async function splitPdfIntoPages(pdfUrl: string, supabaseUrl: string, supabaseKey: string): Promise<PageImage[]> {
  try {
    const response = await fetch(pdfUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }

    const pdfBuffer = await response.arrayBuffer();

    const pdfJsLib = await import('npm:pdfjs-dist@4.0.379/legacy/build/pdf.mjs');

    const pdf = await pdfJsLib.getDocument({
      data: pdfBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    const pages: PageImage[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Failed to get canvas context');
      }

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      const blob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: 0.85
      });

      const arrayBuffer = await blob.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      pages.push({
        pageNumber: pageNum,
        base64Image: base64Image,
        mimeType: 'image/jpeg',
      });
    }

    return pages;
  } catch (error) {
    console.error('Error splitting PDF:', error);
    throw new Error(`Failed to split PDF: ${error.message}`);
  }
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
