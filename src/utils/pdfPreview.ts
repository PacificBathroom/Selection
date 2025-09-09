// src/utils/pdfPreview.ts
// Renders the first page of a PDF to a PNG data URL (browser-only)

import * as pdfjsLib from 'pdfjs-dist';
import PdfJsWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';

// Tell PDF.js to use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerPort = new PdfJsWorker();

/**
 * Get first page of a PDF as a data URL (PNG).
 * You can pass a PDF URL or an ArrayBuffer.
 */
export async function firstPageAsDataUrl(src: string | ArrayBuffer): Promise<string> {
  // Fetch into ArrayBuffer if a URL string was provided
  let data: ArrayBuffer;
  if (typeof src === 'string') {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
    data = await res.arrayBuffer();
  } else {
    data = src;
  }

  // Load the PDF
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;

  // Take page 1
  const page = await pdf.getPage(1);

  // Render to a canvas
  const viewport = page.getViewport({ scale: 2 }); // bump scale for sharper image
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Return PNG data URL
  return canvas.toDataURL('image/png');
}
