// src/utils/pptExporter.ts
// @ts-ignore – pptxgenjs ships no TS types in some builds
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo, Product } from "../types";

/* ---------- style ---------- */
const FONT = "Calibri";
const COLOR_TEXT = "0F172A";
const COLOR_SUB = "334155";
const COLOR_MUTED = "64748B";
const COLOR_FOOTER = "40E0D0"; // turquoise

/* ---------- geometry (16:9) ----------
   Slide size ~13.33 x 7.5 in (pptxgen default for 16:9) */
const G = {
  // title at top
  title: { x: 0.6, y: 0.45, w: 12.1, h: 0.65 },
  // two columns for media
  left:  { x: 0.6,  y: 1.25, w: 6.0,  h: 3.9 },
  right: { x: 6.9,  y: 1.25, w: 5.8,  h: 3.9 },
  // text blocks under media
  desc:  { x: 0.9,  y: 5.35, w: 11.5, h: 0.65 },
  code:  { x: 0.9,  y: 6.05, w: 11.5, h: 0.45 },
  // footer bar
  footerBar: { x: 0, y: 6.75, w: 13.33, h: 0.35 },
  footerTxt: { x: 1.5, y: 6.79, w: 11.0, h: 0.28 },
};

/* ---------- helpers ---------- */
const stripDataUrl = (d: string) => d.replace(/^data:[^;]+;base64,/, "");

// Use your /api/* redirect to Netlify functions
const viaProxy = (u?: string | null) => {
  const s = (u ?? "").toString().trim();
  if (!s || !/^https?:\/\//i.test(s)) return undefined;
  return `/api/pdf-proxy?url=${encodeURIComponent(s)}`;
};

async function fetchAsDataUrl(u: string): Promise<string> {
  const proxied = viaProxy(u);
  if (!proxied) throw new Error("bad url");
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

function tx(slide: any, text: string, opts: any) {
  if (!text) return;
  slide.addText(text, {
    fontFace: FONT,
    color: COLOR_TEXT,
    autoFit: true,              // shrink to fit inside box
    valign: "middle",
    paraSpaceBefore: 0,
    paraSpaceAfter: 0,
    ...opts,
  });
}

function autoTitleSize(name: string) {
  const n = (name || "").length;
  if (n <= 28) return 28;
  if (n <= 36) return 26;
  if (n <= 48) return 24;
  if (n <= 60) return 22;
  return 20;
}

/* normalizes a few header spellings from the sheet */
function pick(obj: any, keys: string[], fallback = ""): string {
  for (const k of keys) {
    const v =
      obj?.[k] ??
      obj?.[k.toLowerCase()] ??
      obj?.[k.replace(/\s+/g, "")] ??
      obj?.[k.replace(/[_-]/g, "")];
    if (v != null && `${v}`.trim() !== "") return String(v);
  }
  return fallback;
}

/* ---------- exporter ---------- */
export async function exportDeckFromProducts({
  client,
  products,
}: {
  client: ClientInfo;
  products: Product[];
}) {
  const pptx = new PptxGenJS();
  // Force widescreen
  (pptx as any).layout = "LAYOUT_16x9";

  // masters for backgrounds – keep exactly as file names in /public
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

  /* --- COVER 1 --- */
  {
    const s = pptx.addSlide({ masterName: "COVER1" });
    tx(s, client.projectName || "Project Selection", {
      ...G.title,
      y: 0.9,
      h: 0.75,
      fontSize: 34,
      bold: true,
    });
    tx(s, `Prepared for ${client.clientName || "Client name"}`, {
      x: 0.8,
      y: 1.8,
      w: 11.6,
      h: 0.4,
      fontSize: 16,
      color: COLOR_SUB,
    });
    tx(
      s,
      client.dateISO
        ? new Date(client.dateISO).toLocaleDateString()
        : new Date().toLocaleDateString(),
      { x: 0.8, y: 2.25, w: 11.6, h: 0.35, fontSize: 12, color: COLOR_MUTED }
    );
    // contact
    if (client.contactName)
      tx(s, client.contactName, { x: 0.8, y: 2.7, w: 11.6, h: 0.35, fontSize: 14 });
    const details = [client.contactEmail, client.contactPhone].filter(Boolean).join(" • ");
    if (details)
      tx(s, details, { x: 0.8, y: 3.1, w: 11.6, h: 0.35, fontSize: 12, color: COLOR_SUB });
  }

  /* --- COVER 2 (contact focus) --- */
  {
    const s = pptx.addSlide({ masterName: "COVER2" });
    tx(s, client.projectName || "Project Selection", {
      ...G.title,
      y: 0.9,
      fontSize: 30,
      bold: true,
    });
    if (client.contactName)
      tx(s, client.contactName, { x: 0.8, y: 1.7, w: 11.6, h: 0.4, fontSize: 16, color: COLOR_SUB });
    const details = [client.contactEmail, client.contactPhone].filter(Boolean).join(" • ");
    if (details)
      tx(s, details, { x: 0.8, y: 2.15, w: 11.6, h: 0.35, fontSize: 12, color: COLOR_MUTED });
  }

  /* --- PRODUCT SLIDES --- */
  for (const row of products as any[]) {
    const name = pick(row, ["Name", "Product"]);
    const code = pick(row, ["Code", "SKU", "Product Code"]);
    const desc = pick(row, ["Description", "Product Description"]);
    const imgUrl = pick(row, ["ImageURL", "Image", "Image Url", "Thumbnail", "image"]);
    const pdfUrl = pick(row, ["PdfURL", "PDF URL", "Specs PDF", "Spec", "SpecsUrl"]);
    const specsText = pick(row, ["Specs", "Specifications"], "");
    const bullets =
      specsText &&
      specsText
        .split(/\r?\n|,|•/g)
        .map((s) => s.trim())
        .filter(Boolean);

    const s = pptx.addSlide();

    // Title at top (centered); autoshrink + fixed height so it never overlaps
    tx(s, name || "Product", {
      ...G.title,
      fontSize: autoTitleSize(name || "Product"),
      bold: true,
      align: "center",
      color: COLOR_TEXT,
    });

    // LEFT: product image
    if (imgUrl) {
      try {
        const dataUrl = await fetchAsDataUrl(imgUrl);
        s.addImage({
          data: stripDataUrl(dataUrl),
          x: G.left.x,
          y: G.left.y,
          w: G.left.w,
          h: G.left.h,
          sizing: { type: "contain", w: G.left.w, h: G.left.h },
        });
      } catch {
        tx(s, "(image failed to load)", {
          x: G.left.x,
          y: G.left.y + G.left.h / 2 - 0.2,
          w: G.left.w,
          h: 0.4,
          fontSize: 12,
          color: COLOR_MUTED,
          align: "center",
        });
      }
    }

    // RIGHT: specs – prefer rendered PDF first page; fall back to bullets
    let drewSpecs = false;
    if (pdfUrl) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdfUrl)!, 1200);
        s.addImage({
          data: stripDataUrl(png),
          x: G.right.x,
          y: G.right.y,
          w: G.right.w,
          h: G.right.h,
          sizing: { type: "contain", w: G.right.w, h: G.right.h },
        });
        drewSpecs = true;
      } catch {
        // fall through to bullets
      }
    }
    if (!drewSpecs && bullets && bullets.length) {
      tx(s, bullets.map((b) => `• ${b}`).join("\n"), {
        x: G.right.x,
        y: G.right.y,
        w: G.right.w,
        h: G.right.h,
        fontSize: 12,
        color: COLOR_SUB,
        align: "left",
      });
    }

    // DESCRIPTION (fixed height + autoshrink + ellipsis)
    if (desc) {
      s.addText(desc, {
        ...G.desc,
        fontFace: FONT,
        color: COLOR_SUB,
        fontSize: 13,
        autoFit: true,
        shrinkText: true,
        fit: "shrink", // tolerated by older builds
        halign: "center",
      } as any);
    }

    // CODE
    if (code) {
      tx(s, code, { ...G.code, fontSize: 12, color: COLOR_TEXT, align: "center" });
    }

    // FOOTER BAR – use addText with fill (no ShapeType usage)
    s.addText("", {
      x: G.footerBar.x,
      y: G.footerBar.y,
      w: G.footerBar.w,
      h: G.footerBar.h,
      fill: { color: COLOR_FOOTER },
    });
    s.addImage({ path: "/logo.png", x: 0.3, y: G.footerTxt.y - 0.02, w: 1.0, h: 0.3 });
    tx(s, "Pacific Bathroom · Project Selections", {
      ...G.footerTxt,
      fontSize: 10,
      color: "FFFFFF",
      align: "left",
    });
  }

  // Always finish with two blank branded slides
  pptx.addSlide({ masterName: "END1" });
  pptx.addSlide({ masterName: "END2" });

  await pptx.writeFile({
    fileName: `${client.projectName || "Project Selection"}.pptx`,
  });
}