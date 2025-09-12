// src/utils/pptExporter.ts
// @ts-ignore
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo, Product } from "../types";

/* ===== STYLE ===== */
const FONT = "Calibri";
const COLOR_TEXT = "0F172A";
const COLOR_SUB = "334155";
const COLOR_MUTED = "64748B";
const COLOR_FOOTER = "40E0D0"; // turquoise

/* ===== GEOMETRY (16:9) =====
   Slide size ~13.33 x 7.5 inches */
const PRODUCT = {
  img:   { x: 0.5, y: 0.7, w: 5.8, h: 3.9 },
  specs: { x: 6.6, y: 0.7, w: 5.9, h: 3.9 },
  title: { x: 0.7, y: 4.8, w: 11.9 },
  desc:  { x: 0.7, y: 5.35, w: 11.9 },
  code:  { x: 0.7, y: 5.9, w: 11.9 },
  footer:{ bar:{ x:0, y:6.95, w:"100%", h:0.35 }, text:{ x:1.5, y:7.0, w:11 } }
};

/* ===== HELPERS ===== */
const tx = (s: any, t: string, o: any) => {
  if (!t) return;
  s.addText(t, {
    fontFace: FONT,
    autoFit: true,       // keep text inside box
    paraSpaceAfter: 0,   // avoid pushing content down
    ...o,
  });
};

const strip = (d: string) => d.replace(/^data:[^;]+;base64,/, "");

// Normalise Drive/Google links to direct file bytes
function normalizeUrl(u?: string | null): string | undefined {
  if (!u) return undefined;
  const s = String(u).trim();
  if (!s) return undefined;

  // https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  const m1 = s.match(/https:\/\/drive\.google\.com\/file\/d\/([^/]+)\//i);
  if (m1 && m1[1]) return `https://drive.google.com/uc?export=download&id=${m1[1]}`;

  // https://drive.google.com/open?id=FILE_ID
  const m2 = s.match(/https:\/\/drive\.google\.com\/open\?id=([^&]+)/i);
  if (m2 && m2[1]) return `https://drive.google.com/uc?export=download&id=${m2[1]}`;

  // https://lh3.googleusercontent.com/d/FILE_ID
  const m3 = s.match(/https:\/\/lh3\.googleusercontent\.com\/d\/([^/?#]+)/i);
  if (m3 && m3[1]) return `https://lh3.googleusercontent.com/d/${m3[1]}`;

  // Dropbox ?dl=0 -> dl=1 (optional)
  if (/^https:\/\/www\.dropbox\.com\//i.test(s)) {
    const url = new URL(s);
    url.searchParams.set("dl", "1");
    return url.toString();
  }

  return s; // unchanged
}

// base64 helper (browser + Node safe)
const toB64 = (str: string) => {
  try {
    // @ts-ignore
    return (typeof Buffer !== "undefined" ? Buffer.from(str, "utf8").toString("base64") : btoa(str));
  } catch {
    return str; // last resort
  }
};

// Proxy any external URL using base64 param
const viaProxy = (u?: string | null) => {
  const norm = normalizeUrl(u);
  if (!norm || !/^https?:\/\//i.test(norm)) return undefined;
  return `/api/pdf-proxy?url_b64=${toB64(norm)}`;
};

async function fetchAsDataUrl(u: string): Promise<string> {
  const proxied = viaProxy(u);
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
  return 16; // very long names
};

function trimDesc(s?: string, max = 280) {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}

// Helper to safely read multiple alias keys from a row
const get = (obj: any, keys: string[], fallback = "") =>
  String(
    keys
      .map((k) => obj?.[k] ?? obj?.[k.toLowerCase()] ?? obj?.[k.replace(/\s+/g, "")])
      .find((v) => v != null) ?? fallback
  );

/* ===== EXPORTER ===== */
export async function exportDeckFromProducts({
  client,
  products,
}: { client: ClientInfo; products: Product[] }) {
  const pptx = new PptxGenJS();
  (pptx as any).layout = "LAYOUT_16x9";

  /* === MASTER SLIDES (locked backgrounds) === */
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
    background: { color: "FFFFFF" }, // simpler than a full-bleed rect
    objects: [],
  });

  /* --- COVER 1 --- */
  {
    const s = pptx.addSlide({ masterName: "COVER1" });
    tx(s, client.projectName || "Project Selection", {
      x: 0.8, y: 1.0, w: 11.5, fontSize: 34, bold: true, color: COLOR_TEXT,
    });
    tx(s, `Prepared for ${client.clientName || "Client"}`, {
      x: 0.8, y: 1.7, w: 11.5, fontSize: 16, color: COLOR_SUB,
    });
    tx(s,
      client.dateISO ? new Date(client.dateISO).toLocaleDateString() : new Date().toLocaleDateString(),
      { x: 0.8, y: 2.1, w: 11.5, fontSize: 12, color: COLOR_MUTED }
    );
    tx(s, client.contactName || "", { x: 0.8, y: 2.6, w: 11.5, fontSize: 14, color: COLOR_TEXT });
    const details = [client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
    tx(s, details, { x: 0.8, y: 3.0, w: 11.5, fontSize: 12, color: COLOR_SUB });
  }

  /* --- COVER 2 (contact info focus) --- */
  {
    const s = pptx.addSlide({ masterName: "COVER2" });
    tx(s, client.projectName || "Project Selection", {
      x: 0.8, y: 1.0, w: 11.5, fontSize: 28, bold: true, color: COLOR_TEXT,
    });
    tx(s, client.contactName || "", { x: 0.8, y: 1.7, w: 11.5, fontSize: 16, color: COLOR_SUB });
    const details2 = [client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
    tx(s, details2, { x: 0.8, y: 2.1, w: 11.5, fontSize: 12, color: COLOR_MUTED });
  }

  /* --- PRODUCT SLIDES --- */
  for (const raw of products) {
    const productName = get(raw, ["Name", "Product"]);
    const productCode = get(raw, ["Code", "SKU", "Product Code"]);
    const imageUrl    = get(raw, ["Image", "ImageURL", "Image Url", "imagebox", "image_box", "Thumbnail"]);
    const pdfUrl      = get(raw, ["PdfURL", "PDF URL", "Specs PDF", "Spec", "SpecsUrl"]);
    const description = get(raw, ["Description", "Product Description"]);
    const specsStr    = get(raw, ["Specs", "Specifications"], "");
    const specsBullets = specsStr ? specsStr.split(/\r?\n|,|•/).map(s => s.trim()).filter(Boolean) : undefined;

    const s = pptx.addSlide({ masterName: "PRODUCT" });

    // Left image (via proxy)
    if (imageUrl) {
      try {
        const d = await fetchAsDataUrl(imageUrl);
        s.addImage({
          data: strip(d),
          ...PRODUCT.img,
          sizing: { type: "contain", w: PRODUCT.img.w, h: PRODUCT.img.h },
        });
      } catch { /* continue without image */ }
    }

    // Right specs: PDF first page -> fallback to bullets
    let specsDrawn = false;
    if (pdfUrl) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdfUrl)!, 1200);
        s.addImage({
          data: strip(png),
          ...PRODUCT.specs,
          sizing: { type: "contain", w: PRODUCT.specs.w, h: PRODUCT.specs.h },
        });
        specsDrawn = true;
      } catch { /* fall back below */ }
    }
    if (!specsDrawn && specsBullets?.length) {
      tx(s, specsBullets.map((b) => `• ${b}`).join("\n"), {
        x: PRODUCT.specs.x, y: PRODUCT.specs.y, w: PRODUCT.specs.w, h: PRODUCT.specs.h,
        fontSize: 12, color: COLOR_SUB,
      });
    }

    // Title / description / code (autoshrink + trimmed desc)
    const titleText = productName || "Product";
    tx(s, titleText, {
      ...PRODUCT.title,
      fontSize: autoTitleSize(titleText),
      bold: true,
      color: COLOR_TEXT,
      align: "center",
    });
    const desc = trimDesc(description, 280);
    if (desc) tx(s, desc, { ...PRODUCT.desc, fontSize: 12, color: COLOR_SUB, align: "center" });
    if (productCode) tx(s, productCode, { ...PRODUCT.code, fontSize: 11, color: COLOR_TEXT, align: "center" });

    // Footer bar (turquoise)
    s.addShape(pptx.ShapeType.rect, {
      ...PRODUCT.footer.bar,
      fill: { color: COLOR_FOOTER },
    });
    s.addImage({ path: "/logo.png", x: 0.3, y: 7.0, w: 1.0, h: 0.3 });
    tx(s, "Pacific Bathroom · Project Selections", {
      x: PRODUCT.footer.text.x, y: PRODUCT.footer.text.y, w: PRODUCT.footer.text.w,
      fontSize: 10, color: "FFFFFF", align: "left",
    });
  }

  /* --- END SLIDES --- */
  pptx.addSlide({ masterName: "END1" });
  pptx.addSlide({ masterName: "END2" });

  await pptx.writeFile({ fileName: `${client.projectName || "Project Selection"}.pptx` });
}
