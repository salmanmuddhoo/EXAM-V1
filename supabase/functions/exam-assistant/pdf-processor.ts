export async function downloadPdfAsBase64Images(pdfUrl: string): Promise<string[]> {
  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }

    const pdfBuffer = await response.arrayBuffer();
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    return [base64Pdf];
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw new Error(`Failed to process PDF: ${error.message}`);
  }
}

export async function fetchPdfFromStorage(supabaseUrl: string, supabaseKey: string, bucket: string, path: string): Promise<ArrayBuffer> {
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF from storage: ${response.statusText}`);
  }

  return await response.arrayBuffer();
}

export function convertPdfBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
