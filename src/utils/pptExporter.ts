// @ts-ignore
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo, Product } from "../types";

/* ===== Theme ===== */
const FONT = "Calibri";
const COLOR_TEXT = "0F172A";
const COLOR_SUB = "334155";
const COLOR_MUTED = "64748B";
const COLOR_FOOTER = "40E0D0"; // turquoise

/* ===== Geometry (16:9 ~ 13.33x7.5in) ===== */
const SLIDE_W = 13.33;

const PRODUCT = {
  img:   { x: 0.5, y: 0.65, w: 5.8,  h: 3.9 },
  specs: { x: 6.6, y: 0.65, w: 5.9,  h: 3.9 },
  title: { x: 0.75, y: 4.75, w: 11.9, h: 0.5 },
  desc:  { x: 0.75, y: 5.25, w: 11.9, h: 0.7 },
  code:  { x: 0.75, y: 5.95, w: 11.9, h: 0.4 },
  footer:{ bar:{ x: 0,  y: 6.95, w: SLIDE_W, h: 0.35 }, text:{ x: 1.5, y: 7.0, w: 11 } }
};

/* ===== Helpers ===== */
const tx = (s: any, t: string | undefined, o: any) => {
  if (!t) return;
  s.addText(t, {
    fontFace: FONT,
    autoFit: true,
    margin: 0,
    paraSpaceAfter: 0,
    paraSpaceBefore: 0,
    ...o,
  });
};

const strip = (d: string) => d.replace(/^data:[^;]+;base64,/, "");

/** Support many Drive & Googleusercontent URL shapes */
function normalizeUrl(u?: string | null): string | undefined {
  if (!u) return;
  let s = String(u).trim();
  if (!s) return;

  // Handle “sharing” links like .../file/d/<id>/view?usp=sharing
  let m = s.match(/https:\/\/drive\.google\.com\/file\/d\/([^/]+)\//i);
  if (m?.[1]) return `https://drive.google.com/uc?export=download&id=${m[1]}`;

  // open?id=<id>
  m = s.match(/[?&]id=([^&]+)/i);
  if (m?.[1] && /drive\.google\.com/i.test(s)) {
    return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  }

  // Docs “uc” links are fine as-is
  if (/https:\/\/drive\.google\.com\/uc\?/.test(s)) return s;

  // lh3.googleusercontent direct file links are fine
  if (/^https:\/\/(?:lh\d+|googleusercontent)\.googleusercontent\.com/i.test(s)) return s;

  // Generic: leave other https URLs alone
  if (/^https?:\/\//i.test(s)) return s;

  return undefined;
}

/** Base64 that works in browser/Node */
function toB64Url(str: string): string {
  try { return btoa(unescape(encodeURIComponent(str))); }
  catch { try { return Buffer.from(str, "utf8").toString("base64"); } catch { return str; } }
}

/** Absolute proxy URL (pptxgenjs can be picky) */
function proxyUrl(u?: string | null): string | undefined {
  const norm = normalizeUrl(u);
  if (!norm) return;
  const base = (typeof window !== "undefined" && window.location?.origin)
    ? window.location.origin
    : "";
  const p = `/api/pdf-proxy?url_b64=${toB64Url(norm)}`;
  return base ? new URL(p, base).toString() : p;
}

async function fetchAsDataUrl(u: string): Promise<string> {
  const proxied = proxyUrl(u);
  if (!proxied) throw new Error("Bad URL");
  const res = await fetch(proxied, { credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

const autoTitleSize = (name: string) => {
  const len = name?.length || 0;
  if (len <= 28) return 24;
  if (len <= 36) return 22;
  if (len <= 48) return 20;
  if (len <= 60) return 18;
  return 16;
};

function trimDesc(s?: string, max = 220) {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}

/** Case/space tolerant field picker */
function pick(obj: any, labels: string[], fallback = ""): string {
  for (const k of labels) {
    if (obj?.[k] != null) return String(obj[k]);
    const low = k.toLowerCase();
    const smo = k.replace(/\s+/g, "");
    if (obj?.[low] != null) return String(obj[low]);
    if (obj?.[smo] != null) return String(obj[smo]);
  }
  return fallback;
}

/* ===== Exporter ===== */
export async function exportDeckFromProducts({
  client,
  products,
}: { client: ClientInfo; products: Product[] }) {
  const pptx = new PptxGenJS();
  (pptx as any).layout = "LAYOUT_16x9";

  /* Master slides */
  pptx.defineSlideMaster({
    title: "COVER1",
    objects: [{ image: { path: "/cover-bg-1.png", x: 0, y: 0, w: "100%", h: "100%" } }],
  });
  pptx.defineSlideMaster({
    title: "COVER2",
    objects: [{ image: { path: "/cover-bg-2.png", x: 0, y: 0, w: "100%", h: "100%" } }],
  });
  pptx.defineSlideMaster({
    title: "END1",
    objects: [{ image: { path: "/end-bg-1.png", x: 0, y: 0, w: "100%", h: "100%" } }],
  });
  pptx.defineSlideMaster({
    title: "END2",
    objects: [{ image: { path: "/end-bg-2.png", x: 0, y: 0, w: "100%", h: "100%" } }],
  });
  pptx.defineSlideMaster({
    title: "PRODUCT",
    background: { color: "FFFFFF" },
    objects: [],
  });

  /* Cover 1 */
  {
    const s = pptx.addSlide({ masterName: "COVER1" });
    tx(s, client.projectName || "Project Selection", {
      x: 0.8, y: 1.0, w: 11.5, fontSize: 34, bold: true, color: COLOR_TEXT,
    });
    tx(s, `Prepared for ${client.clientName || "Client"}`, {
      x: 0.8, y: 1.7, w: 11.5, fontSize: 16, color: COLOR_SUB,
    });
    tx(
      s,
      client.dateISO ? new Date(client.dateISO).toLocaleDateString() : new Date().toLocaleDateString(),
      { x: 0.8, y: 2.1, w: 11.5, fontSize: 12, color: COLOR_MUTED }
    );
    // Contact block
    tx(s, client.contactName || "", { x: 0.8, y: 2.6, w: 11.5, fontSize: 14, color: COLOR_TEXT });
    const details = [client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
    tx(s, details, { x: 0.8, y: 3.0, w: 11.5, fontSize: 12, color: COLOR_SUB });
  }

  /* Cover 2 (contact focused) */
  {
    const s = pptx.addSlide({ masterName: "COVER2" });
    tx(s, client.projectName || "Project Selection", {
      x: 0.8, y: 1.0, w: 11.5, fontSize: 28, bold: true, color: COLOR_TEXT,
    });
    tx(s, client.contactName || "", { x: 0.8, y: 1.7, w: 11.5, fontSize: 16, color: COLOR_SUB });
    const details2 = [client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
    tx(s, details2, { x: 0.8, y: 2.1, w: 11.5, fontSize: 12, color: COLOR_MUTED });
  }

  /* Product slides */
  for (const raw of products) {
    const productName = pick(raw, ["Name", "Product"], "Product");
    const productCode = pick(raw, ["Code", "SKU", "Product Code"], "");
    const imageUrl    = pick(raw, ["Image", "ImageURL", "Image Url", "imagebox", "image_box", "Thumbnail"], "");
    const pdfUrl      = pick(raw, ["PdfURL", "PDF URL", "Specs PDF", "Spec", "SpecsUrl"], "");
    const description = pick(raw, ["Description", "Product Description"], "");
    const specsStr    = pick(raw, ["Specs", "Specifications"], "");
    const specsBullets = specsStr ? specsStr.split(/\r?\n|,|•/).map(s => s.trim()).filter(Boolean) : undefined;

    const s = pptx.addSlide({ masterName: "PRODUCT" });

    // Image (with logging if it fails)
    if (imageUrl) {
      try {
        const d = await fetchAsDataUrl(imageUrl);
        s.addImage({
          data: strip(d),
          ...PRODUCT.img,
          sizing: { type: "contain", w: PRODUCT.img.w, h: PRODUCT.img.h },
        });
      } catch (e) {
        console.warn("Image fetch failed:", imageUrl, e);
        tx(s, "Image unavailable", {
          x: PRODUCT.img.x, y: PRODUCT.img.y, w: PRODUCT.img.w, h: PRODUCT.img.h,
          fontSize: 12, color: COLOR_MUTED, align: "center",
        });
      }
    }

    // Specs: first page of PDF or bullets
    let specsDrawn = false;
    if (pdfUrl) {
      try {
        const prox = proxyUrl(pdfUrl)!; // absolute proxy URL
        const png = await renderPdfFirstPageToDataUrl(prox, 1000); // slightly smaller for speed & fit
        s.addImage({
          data: strip(png),
          ...PRODUCT.specs,
          sizing: { type: "contain", w: PRODUCT.specs.w, h: PRODUCT.specs.h },
        });
        specsDrawn = true;
      } catch (e) {
        console.warn("PDF preview failed:", pdfUrl, e);
      }
    }
    if (!specsDrawn && specsBullets?.length) {
      tx(s, specsBullets.map((b) => `• ${b}`).join("\n"), {
        x: PRODUCT.specs.x, y: PRODUCT.specs.y, w: PRODUCT.specs.w, h: PRODUCT.specs.h,
        fontSize: 11.5, color: COLOR_SUB,
      });
    }

    // Title / description / code (autoFit + trimmed)
    const title = productName || "Product";
    tx(s, title, {
      ...PRODUCT.title, fontSize: autoTitleSize(title), bold: true, color: COLOR_TEXT, align: "center",
    });

    const desc = trimDesc(description, 220);
    if (desc) tx(s, desc, { ...PRODUCT.desc, fontSize: 11.5, color: COLOR_SUB, align: "center" });

    if (productCode) tx(s, productCode, { ...PRODUCT.code, fontSize: 11, color: COLOR_TEXT, align: "center" });

    // Footer bar (string "rect" for broad pptxgenjs support)
    s.addShape("rect", {
      ...PRODUCT.footer.bar,
      fill: { color: COLOR_FOOTER },
    });
    s.addImage({ path: "/logo.png", x: 0.3, y: 7.0, w: 1.0, h: 0.3 });
    tx(s, "Pacific Bathroom · Project Selections", {
      x: PRODUCT.footer.text.x, y: PRODUCT.footer.text.y, w: PRODUCT.footer.text.w,
      fontSize: 10, color: "FFFFFF", align: "left",
    });
  }

  /* End slides (background only) */
  pptx.addSlide({ masterName: "END1" });
  pptx.addSlide({ masterName: "END2" });

  await pptx.writeFile({ fileName: `${client.projectName || "Project Selection"}.pptx` });
}