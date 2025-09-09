import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.mjs'; // Vite can bundle ESM worker

// Render first page to a data URL (PNG)
export async function renderPdfFirstPageToDataUrl(pdfUrl: string, width = 1200): Promise<string> {
  // pdfjs worker config (for vite + ESM)
  // @ts-ignore
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    // vite can import the worker mjs from the package
    // (no need to set workerSrc string path)
  }

  const loadingTask = pdfjsLib.getDocument({ url: pdfUrl, withCredentials: false });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1 });
  const scale = width / viewport.width;
  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = Math.floor(scaledViewport.width);
  canvas.height = Math.floor(scaledViewport.height);

  const renderTask = page.render({ canvasContext: ctx, viewport: scaledViewport });
  await renderTask.promise;

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl;
}
