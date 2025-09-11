// src/utils/pptExporter.ts

// Types aren’t exported in this build; use default export and loose typing
// @ts-ignore
import PptxGenJS from "pptxgenjs";

type TableRow = any;
type TableCell = any;

import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { Section, Product, ClientInfo } from "../types";

/** Proxy any external URL via our Netlify function (keeps CORS clean) */
const viaProxy = (u?: string | null) =>
  u && /^https?:\/\//i.test(u) ? `/api/pdf-proxy?url=${encodeURIComponent(u)}` : u || undefined;

function cleanText(input?: string | null, maxLen = 1200): string | undefined {
  if (!input) return undefined;
  let s = String(input);
  s = s.replace(/window\._wpemojiSettings[\s\S]*?\};?/gi, " ");
  s = s.replace(/\/\*![\s\S]*?\*\//g, " ");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/\S{120,}/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen).trimEnd() + "…";
  return s || undefined;
}

type SpecRow = { label?: string; value?: string } | string;

function normalizeSpecs(
  specs?: any
): { kv?: { label: string; value: string }[]; bullets?: string[] } {
  if (!Array.isArray(specs) || specs.length === 0) return {};
  const kv: { label: string; value: string }[] = [];
  const bullets: string[] = [];
  (specs as SpecRow[]).forEach((s) => {
    if (s && typeof s === "object" && ("label" in s || "value" in s)) {
      kv.push({
        label: String((s as any).label ?? "").trim(),
        value: String((s as any).value ?? "").trim(),
      });
    } else {
      bullets.push(String(s));
    }
  });
  return { kv: kv.length ? kv : undefined, bullets: bullets.length ? bullets : undefined };
}

async function urlToDataUrl(u: string): Promise<string> {
  const proxied = viaProxy(u)!;
  const res = await fetch(proxied, { credentials: "omit" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} for ${u}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

const stripDataPrefix = (dataUrl: string) => dataUrl.replace(/^data:[^;]+;base64,/, "");

type ExportArgs = { client: ClientInfo; sections: Section[] };

/**
 * Export a PowerPoint deck using current client info and selected products.
 * NOTE: This version is aligned with Google Sheets column names:
 * - product title: product.product (fallback product.name)
 * - thumbnail: product.thumbnail (fallback product.image)
 * - PDF: product.pdf_url (fallback product.specPdfUrl)
 * - source link (optional): product.source_url (fallback product.sourceUrl)
 */
export async function exportDeckPptx({ client, sections }: ExportArgs) {
  const pptx = new PptxGenJS();
  // A4 so it prints nicely
  pptx.layout = "A4"; // 8.27 x 11.69 in

  // ------------- Cover -------------
  {
    const slide = pptx.addSlide();
    slide.addText("SELECTION DECK", {
      x: 0.5,
      y: 0.4,
      w: 7.3,
      fontSize: 12,
      bold: true,
      color: "666666",
    });

    slide.addText(client.projectName || "Project Selection", {
      x: 0.5,
      y: 0.9,
      w: 7.3,
      fontSize: 32,
      bold: true,
      color: "0F172A",
    });

    slide.addText(`Prepared for ${client.clientName || "Client name"}`, {
      x: 0.5,
      y: 1.6,
      w: 7.3,
      fontSize: 14,
      color: "334155",
    });

    const dateStr = client.dateISO
      ? new Date(client.dateISO).toLocaleDateString()
      : new Date().toLocaleDateString();
    slide.addText(dateStr, { x: 0.5, y: 1.95, w: 7.3, fontSize: 12, color: "64748B" });

    // Centered logo (ensure /logo.png exists or change the path)
    slide.addImage({
      path: "/logo.png",
      x: 1.65, // center-ish
      y: 2.7,
      w: 5.0,
      h: 2.3,
    });

    slide.addText("Built with React + Tailwind  ·  Exported from Pacific Bathroom Selection", {
      x: 0.5,
      y: 5.0,
      w: 7.3,
      fontSize: 9,
      color: "94A3B8",
      align: "center",
    });
  }

  // Collect all products from sections (legacy structure)
  const allProducts: { sectionIndex: number; product: Product; sectionTitle: string }[] = [];
  sections.forEach((s, idx) => {
    (s.products || []).forEach((p: Product) =>
      allProducts.push({ sectionIndex: idx, product: p, sectionTitle: s.title || "" })
    );
  });

  // ------------- Product slides (one per product) -------------
  for (const { sectionIndex, product, sectionTitle } of allProducts) {
    const slide = pptx.addSlide();

    // Title uses Google Sheets "product" column; fallbacks to "name"
    const productTitle =
      (product.product as string) || (product.name as string) || "Product";

    slide.addText(`${sectionTitle || `Selection`}  –  ${productTitle}`, {
      x: 0.5,
      y: 0.3,
      w: 7.3,
      fontSize: 16,
      bold: true,
      color: "0F172A",
    });

    // Left: product image (thumbnail) and optional first page of PDF
    let imgData: string | undefined;

    // Prefer Google Sheets "thumbnail", fallback to "image"
    const imageUrl =
      (product.thumbnail as string) || (product.image as string) || "";

    const leftX = 0.5;
    let leftY = 0.9;
    const leftW = 4.3;

    if (imageUrl) {
      try {
        const dataUrl = await urlToDataUrl(imageUrl);
        imgData = stripDataPrefix(dataUrl);
      } catch {
        // ignore fetch failures
      }
    }

    if (imgData) {
      slide.addImage({
        data: imgData,
        x: leftX,
        y: leftY,
        w: leftW,
        h: 4.0,
        sizing: { type: "contain", w: leftW, h: 4.0 },
      });
      leftY += 4.2;
    }

    // Spec PDF first page preview: prefer "pdf_url", fallback to "specPdfUrl"
    const pdfUrl = (product.pdf_url as string) || (product.specPdfUrl as string) || "";
    if (pdfUrl) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdfUrl)!, 1200);
        slide.addImage({
          data: stripDataPrefix(png),
          x: leftX,
          y: leftY,
          w: leftW,
          h: 3.2,
          sizing: { type: "contain", w: leftW, h: 3.2 },
        });
      } catch {
        // ignore pdf render failures
      }
    }

    // Right column: link + description + specifications
    const rightX = 5.1;
    let rightY = 0.9;

    // Optional source link: prefer "source_url", fallback "sourceUrl"
    const sourceUrl =
      (product.source_url as string) || (product.sourceUrl as string) || "";
    if (sourceUrl) {
      slide.addText(sourceUrl, {
        x: rightX,
        y: rightY,
        w: 2.6,
        fontSize: 10,
        color: "2563EB",
        hyperlink: { url: sourceUrl },
      });
      rightY += 0.25;
    }

    if (product.description) {
      const desc = cleanText(product.description as string, 600);
      if (desc) {
        slide.addText(desc, { x: rightX, y: rightY, w: 2.6, fontSize: 11, color: "334155" });
        rightY += 1.0;
      }
    }

    // Specifications block
    slide.addText("Specifications", {
      x: rightX,
      y: rightY,
      w: 2.6,
      fontSize: 12,
      bold: true,
      color: "0F172A",
    });
    rightY += 0.24;

    const { kv, bullets } = normalizeSpecs((product as any).specs);

    if (kv && kv.length) {
      // render as two-column table
      const rows: TableRow[] = kv.map((r) => [
        { text: r.label || "" } as TableCell,
        { text: r.value || "" } as TableCell,
      ]);

      slide.addTable(rows, {
        x: rightX,
        y: rightY,
        w: 2.6,
        fontSize: 10,
        colW: [1.0, 1.6],
        // Minimal styling; uncomment to strip borders completely (depends on pptxgen version):
        // border: { type: "none" } as any,
      });
      rightY += 0.24 + Math.min(3.5, kv.length * 0.24);
    } else if (bullets && bullets.length) {
      slide.addText(bullets.map((b: string) => `• ${b}`).join("\n"), {
        x: rightX,
        y: rightY,
        w: 2.6,
        fontSize: 10.5,
        color: "334155",
      });
      rightY += 0.24 + Math.min(3.5, bullets.length * 0.22);
    } else if ((product as any).features && (product as any).features.length) {
      slide.addText(
        ((product as any).features as string[]).map((b) => `• ${b}`).join("\n"),
        { x: rightX, y: rightY, w: 2.6, fontSize: 10.5, color: "334155" }
      );
      rightY += 0.24 + Math.min(3.5, (product as any).features.length * 0.22);
    } else {
      slide.addText("—", { x: rightX, y: rightY, w: 2.6, fontSize: 10.5, color: "94A3B8" });
      rightY += 0.24;
    }
  }

  // Save deck
  await pptx.writeFile({
    fileName: `${client.projectName || "Project Selection"}.pptx`,
  });
}
