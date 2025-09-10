// src/utils/pdfPreview.ts
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Vite-friendly worker URL import.
// If this line errors, see the note below about vite-env.d.ts.
import pdfWorker from 'pdfjs-dist/build/pdf.worker?worker&url';

// Tell PDF.js where the worker is
GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Render the first page of a PDF to a PNG data URL.
 * @param file File | ArrayBuffer | Uint8Array
 * @param maxWidth Maximum width of the generated image (keeps aspect ratio)
 * @returns data URL (e.g., "data:image/png;base64,...")
 */
export async function renderPdfFirstPageToDataUrl(
  file: File | ArrayBuffer | Uint8Array,
  maxWidth = 800
): Promise<string> {
  const data = await toArrayBuffer(file);

  const loadingTask = getDocument({ data });
  const pdf: PDFDocumentProxy = await loadingTask.promise;

  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });

  const scale = Math.min(1, maxWidth / viewport.width);
  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(scaledViewport.width);
  canvas.height = Math.ceil(scaledViewport.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context not available');

  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

  const dataUrl = canvas.toDataURL('image/png');

  // Clean up
  canvas.width = 0;
  canvas.height = 0;

  return dataUrl;
}

async function toArrayBuffer(input: File | ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  if (input instanceof ArrayBuffer) return input;
  if (input instanceof Uint8Array) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  }
  // File
  return await input.arrayBuffer();
}
