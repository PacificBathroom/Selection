// src/api/exportPdf.ts
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type PageSize = "a4" | "letter";
type Orientation = "portrait" | "landscape";

export interface ExportPdfOptions {
  /** Element or a CSS selector for the area you want to export */
  target: HTMLElement | string;
  /** A4 (default) or US Letter */
  page?: PageSize;
  /** portrait (default) or landscape */
  orientation?: Orientation;
  /** Outer margin in millimeters (default 10) */
  marginMm?: number;
  /** File name (default: Project Selection.pdf) */
  filename?: string;
  /** 1–3 typically. If omitted we use devicePixelRatio (capped at 2.5) */
  scale?: number;
  /** Optional header/footer text drawn on every page (after rendering) */
  headerText?: string;
  footerText?: string;
  /** Called with simple progress messages */
  onProgress?: (msg: string) => void;
}

/** Quick map of common page sizes in mm */
const PAGE_MM: Record<PageSize, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  letter: { w: 216, h: 279 },
};

function getElement(target: HTMLElement | string): HTMLElement {
  if (typeof target !== "string") return target;
  const el = document.querySelector<HTMLElement>(target);
  if (!el) throw new Error(`exportPdf: target "${target}" not found`);
  return el;
}

function capo(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function waitForImages(container: HTMLElement) {
  const imgs = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    imgs.map((img) => {
      // Help CORS when possible
      if (!img.crossOrigin && /^https?:\/\//i.test(img.src)) {
        img.crossOrigin = "anonymous";
      }
      if (img.complete && img.naturalWidth > 0) return;
      return new Promise<void>((res) => {
        img.onload = () => res();
        img.onerror = () => res(); // don’t block on broken images
      });
    })
  );
}

/**
 * Export a DOM region to a multi-page PDF.
 * Slices a tall canvas into page-sized chunks so you get crisp text & images.
 */
export async function exportSelectionToPdf(opts: ExportPdfOptions) {
  const {
    page = "a4",
    orientation = "portrait",
    filename = "Project Selection.pdf",
    marginMm = 10,
    scale,
    headerText,
    footerText,
    onProgress,
  } = opts;

  const container = getElement(opts.target);

  onProgress?.("Preparing images…");
  await waitForImages(container);

  // Make a high-DPI canvas of the target element
  const dpr = capo(scale ?? window.devicePixelRatio ?? 1, 1, 2.5);
  onProgress?.(`Rasterizing (scale x${dpr.toFixed(1)})…`);
  const canvas = await html2canvas(container, {
    backgroundColor: "#ffffff",
    scale: dpr,
    useCORS: true,
    allowTaint: false,
    logging: false,
    windowWidth: document.documentElement.scrollWidth, // avoid mobile reflow
  });

  // PDF setup
  const p = PAGE_MM[page];
  const isLandscape = orientation === "landscape";
  const pageWmm = isLandscape ? p.h : p.w;
  const pageHmm = isLandscape ? p.w : p.h;
  const pdf = new jsPDF({ unit: "mm", format: [pageWmm, pageHmm], orientation });

  // Fit width; derive mm-per-pixel
  const innerWmm = pageWmm - marginMm * 2;
  const innerHmm = pageHmm - marginMm * 2;
  const mmPerPx = innerWmm / canvas.width;
  const pageHeightPx = Math.floor(innerHmm / mmPerPx);

  // Slice the big canvas into page-height chunks
  const totalHeight = canvas.height;
  const ctxSrc = canvas.getContext("2d")!;
  let offsetY = 0;
  let pageIndex = 0;

  while (offsetY < totalHeight) {
    const sliceHeightPx = Math.min(pageHeightPx, totalHeight - offsetY);
    // Create a slice canvas
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceHeightPx;
    const ctx = slice.getContext("2d")!;
    // Copy region from the big canvas
    ctx.drawImage(
      canvas,
      0,
      offsetY,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      slice.width,
      slice.height
    );

    const imgData = slice.toDataURL("image/jpeg", 0.92);
    const sliceHmm = sliceHeightPx * mmPerPx;

    if (pageIndex > 0) pdf.addPage();

    pdf.addImage(
      imgData,
      "JPEG",
      marginMm,
      marginMm,
      innerWmm,
      sliceHmm,
      undefined,
      "FAST"
    );

    // Optional header/footer text (vector text so it stays crisp)
    if (headerText || footerText) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor("#667085");
      if (headerText) {
        pdf.text(headerText, marginMm, 6);
      }
      if (footerText) {
        pdf.text(footerText, pageWmm - marginMm, pageHmm - 4, { align: "right" });
      }
    }

    offsetY += sliceHeightPx;
    pageIndex++;
    onProgress?.(`Compositing page ${pageIndex}…`);
  }

  onProgress?.("Saving PDF…");
  pdf.save(filename);
  onProgress?.("Done.");
}