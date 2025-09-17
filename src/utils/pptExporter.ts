// src/utils/pptExporter.ts
// @ts-ignore – pptxgenjs has loose types by default
import PptxGenJS from "pptxgenjs";
import type { ClientInfo, Product } from "../types";
// If you already have this util, we use it; otherwise you can stub it to always throw to force bullet fallback.
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";

/* ========== CONSTANTS & STYLE ========== */
const SLIDE_W = 13.33; // 16:9 width in inches used by pptxgenjs
const SLIDE_H = 7.5;

const FONT = "Calibri";
const COLOR_TEXT = "0F172A";
const COLOR_SUB = "334155";
const COLOR_MUTED = "64748B";
const COLOR_FOOTER = "40E0D0"; // turquoise

// Layout: Title at top, image left, specs right, description/code below
const L = {
  title: { x: 0.7, y: 0.55, w: SLIDE_W - 1.4, h: 0.6 },
  img:   { x: 0.6, y: 1.4,  w: 5.8, h: 3.9 },
  specs: { x: 6.9, y: 1.4,  w: 5.8, h: 3.9 },
  desc:  { x: 0.7, y: 5.5,  w: SLIDE_W - 1.4, h: 0.8 },
  code:  { x: 0.7, y: 6.3,  w: SLIDE_W - 1.4, h: 0.4 },
  footerBar: { x: 0, y: 7.0, w: SLIDE_W, h: 0.3 },
  footerText: { x: 1.5, y: 7.03, w: SLIDE_W - 1.8, h: 0.3 },
  footerLogo: { x: 0.3, y: 7.02, w: 1.0, h: 0.3 },
};

const tx = (s: any, text: string | undefined, opts: any) => {
  if (!text) return;
  s.addText(text, {
    fontFace: FONT,
    color: COLOR_TEXT,
    paraSpaceAfter: 0,
    autoFit: true, // shrink-to-fit
    ...opts,
  });
};

const stripDataUrl = (d: string) => d.replace(/^data:[^;]+;base64,/, "");

/** Route any remote file through our Netlify proxy to avoid CORS */
const viaProxy = (u?: string | null) => {
  const s = (u ?? "").toString().trim();
  if (!/^https?:\/\//i.test(s)) return undefined;
  return `/api/pdf-proxy?url=${encodeURIComponent(s)}`;
};

async function fetchAsDataUrl(u: string): Promise<string> {
  const proxied = viaProxy(u);
  if (!proxied) throw new Error("Bad URL");
  const res = await fetch(proxied, { credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result) || "");
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

const autoTitleSize = (name?: string) => {
  const len = name?.length || 0;
  if (len <= 28) return 24;
  if (len <= 36) return 22;
  if (len <= 48) return 20;
  if (len <= 60) return 18;
  return 16;
};

function first<T = string>(obj: any, keys: string[]): T | "" {
  for (const k of keys) {
    const v =
      obj?.[k] ??
      obj?.[k.toLowerCase?.()] ??
      obj?.[k.replace?.(/\s+/g, "")] ??
      obj?.[k.replace?.(/_/g, "")];
    if (v != null && String(v).trim() !== "") return v as T;
  }
  return "" as unknown as T;
}

/* ========== EXPORTER ========== */
export async function exportDeckFromProducts({
  client,
  products,
}: {
  client: ClientInfo;
  products: Product[];
}) {
  const pptx = new PptxGenJS();
  (pptx as any).layout = "LAYOUT_16x9";

  // COVER SLIDE (optional – simple header so export is never empty)
  const cover = pptx.addSlide();
  tx(cover, client.projectName || "Project Selection", {
    x: 0.8,
    y: 1.0,
    w: SLIDE_W - 1.6,
    h: 0.8,
    fontSize: 34,
    bold: true,
    color: COLOR_TEXT,
  });
  tx(
    cover,
    `Prepared for ${client.clientName || "Client name"}`,
    { x: 0.8, y: 1.8, w: SLIDE_W - 1.6, h: 0.4, fontSize: 16, color: COLOR_SUB }
  );
  tx(
    cover,
    client.dateISO
      ? new Date(client.dateISO).toLocaleDateString()
      : new Date().toLocaleDateString(),
    { x: 0.8, y: 2.2, w: SLIDE_W - 1.6, h: 0.3, fontSize: 12, color: COLOR_MUTED }
  );

  // PRODUCT SLIDES
  for (const raw of products) {
    const title =
      first<string>(raw, ["name", "Name", "product", "Product"]) || "Product";

    const imageUrl =
      first<string>(raw, ["imageurl", "imageUrl", "image", "thumbnail"]) || "";

    const pdfUrl =
      first<string>(raw, ["pdfurl", "PdfURL", "specPdfUrl", "specpdfurl"]) || "";

    const description =
      first<string>(raw, ["description", "Description"]) || "";

    const code =
      first<string>(raw, ["code", "Code", "sku", "SKU"]) || "";

    const specsText =
      (Array.isArray(raw.specs)
        ? raw.specs.map((x: any) => `${x?.label ?? ""} ${x?.value ?? ""}`.trim())
        : (raw.specs as unknown as string)) ||
      (raw.specifications as unknown as string) ||
      "";

    const s = pptx.addSlide();

    // Title (top)
    tx(s, title, {
      ...L.title,
      align: "center",
      bold: true,
      fontSize: autoTitleSize(title),
      color: COLOR_TEXT,
    });

    // Left image (or placeholder)
    let drewImage = false;
    if (imageUrl) {
      try {
        const data = await fetchAsDataUrl(imageUrl);
        s.addImage({
          data: stripDataUrl(data),
          ...L.img,
          sizing: { type: "contain", w: L.img.w, h: L.img.h },
        });
        drewImage = true;
      } catch {
        // fall through to placeholder
      }
    }
    if (!drewImage) {
      // light grey placeholder
      s.addShape(pptx.ShapeType.rect, {
        x: L.img.x,
        y: L.img.y,
        w: L.img.w,
        h: L.img.h,
        fill: { color: "F1F5F9" },
        line: { color: "CBD5E1" },
      });
    }

    // Specs: prefer PDF first page; fallback to bullets/text; fallback to placeholder
    let drewSpecs = false;
    if (pdfUrl) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdfUrl)!, 1400);
        s.addImage({
          data: stripDataUrl(png),
          ...L.specs,
          sizing: { type: "contain", w: L.specs.w, h: L.specs.h },
        });
        drewSpecs = true;
      } catch {
        // fall back to text
      }
    }
    if (!drewSpecs && specsText) {
      // Try to make bullets if possible
      const bullets = String(specsText)
        .split(/\r?\n|•|,|;|\u2022/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => `• ${t}`)
        .join("\n");

      tx(s, bullets, {
        x: L.specs.x,
        y: L.specs.y,
        w: L.specs.w,
        h: L.specs.h,
        fontSize: 12,
        color: COLOR_SUB,
      });
      drewSpecs = true;
    }
    if (!drewSpecs) {
      s.addShape(pptx.ShapeType.rect, {
        x: L.specs.x,
        y: L.specs.y,
        w: L.specs.w,
        h: L.specs.h,
        fill: { color: "F1F5F9" },
        line: { color: "CBD5E1" },
      });
    }

    // Description (autoshrink inside a fixed box so it can't spill)
    if (description) {
      tx(s, description, {
        ...L.desc,
        align: "center",
        fontSize: 12,
        color: COLOR_SUB,
      });
    }

    // Code line
    if (code) {
      tx(s, code, {
        ...L.code,
        align: "center",
        fontSize: 11,
        color: COLOR_TEXT,
      });
    }

    // Footer bar + (optional) logo left + label
    s.addShape(pptx.ShapeType.rect, {
      x: L.footerBar.x,
      y: L.footerBar.y,
      w: L.footerBar.w,
      h: L.footerBar.h,
      fill: { color: COLOR_FOOTER },
      line: { color: COLOR_FOOTER },
    });
    // If you have /logo.png in public/
    s.addImage({
      path: "/logo.png",
      x: L.footerLogo.x,
      y: L.footerLogo.y,
      w: L.footerLogo.w,
      h: L.footerLogo.h,
    });
    tx(s, "Pacific Bathroom · Project Selections", {
      x: L.footerText.x,
      y: L.footerText.y,
      w: L.footerText.w,
      h: L.footerText.h,
      align: "left",
      color: "FFFFFF",
      fontSize: 10,
    });
  }

  // SIMPLE END SLIDE
  const end = pptx.addSlide();
  tx(end, "Thank you", {
    x: 0.8,
    y: 3.2,
    w: SLIDE_W - 1.6,
    h: 0.8,
    align: "center",
    bold: true,
    fontSize: 28,
  });

  await pptx.writeFile({
    fileName: `${client.projectName || "Project Selection"}.pptx`,
  });
}
