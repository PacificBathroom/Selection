// src/utils/pdfPreview.ts
import { getDocument } from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.min.mjs';

export async function renderPdfFirstPageToDataUrl(url: string, maxWidth = 1000): Promise<string> {
  const loadingTask = getDocument(url);
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(1, maxWidth / viewport.width);
  const scaled = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = Math.floor(scaled.width);
  canvas.height = Math.floor(scaled.height);

  await page.render({ canvasContext: ctx, viewport: scaled }).promise;
  return canvas.toDataURL('image/png');
}
