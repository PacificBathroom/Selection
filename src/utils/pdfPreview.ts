import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs";

// tell pdfjs where its worker is
GlobalWorkerOptions.workerSrc = pdfWorker;

// ... your preview logic


// Renders the first page of a remote PDF URL into a PNG data URL
export async function renderPdfFirstPageToDataUrl(url: string, maxWidth = 1000): Promise<string> {
  // pdf.js will fetch the URL directly; if CORS blocks it, use the /api/pdf-proxy (see step 4)
  const loading = getDocument({ url });
  const pdf = await loading.promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(1, maxWidth / viewport.width);
  const scaled = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = Math.ceil(scaled.width);
  canvas.height = Math.ceil(scaled.height);

  await page.render({ canvasContext: ctx, viewport: scaled }).promise;
  return canvas.toDataURL('image/png');
}
