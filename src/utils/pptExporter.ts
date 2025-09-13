// src/utils/pptExporter.ts
// @ts-ignore
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo, Product } from "../types";

/* ========= BRAND / STYLE ========= */
const FONT = "Calibri";
const COLOR_TEXT = "0F172A";
const COLOR_SUB = "334155";
const COLOR_MUTED = "64748B";
const COLOR_FOOTER = "40E0D0"; // turquoise

/* ========= 16:9 GEOMETRY =========
   Slide is ~13.33 x 7.5 in */
const LAYOUT = {
  // Title centered near top
  title: { x: 0.7, y: 0.55, w: 11.9, h: 0.6 },

  // Two content boxes under the title
  img:   { x: 0.6, y: 1.25, w: 6.1, h: 3.6 },
  specs: { x: 7.1, y: 1.25, w: 5.6, h: 3.6 },

  // Text rows underneath the content boxes
  desc:  { x: 0.8, y: 5.05, w: 11.5, h: 0.9 },
  code:  { x: 0.8, y: 5.95, w: 11.5, h: 0.5 },

  // Footer
  footerBar: { x: 0, y: 6.95, w: 13.33, h: 0.35 },
  footerText: { x: 1.5, y: 7.0, w: 11.0, h: 0.3 },
  footerLogo: { x: 0.3, y: 7.0, w: 1.0, h: 0.3 },
};

// helper: safe addText with autoshrink
function addTextBox(s: any, text: string | undefined, opts: any) {
  if (!text) return;
  s.addText(text, {
    fontFace: FONT,
    color: COLOR_TEXT,
    autoFit: true,          // shrink to fit inside h/w
    paraSpaceAfter: 0,
    ...opts,
  });
}

const stripPrefix = (d: string) => d.replace(/^data:[^;]+;base64,/, "");

/** Proxy any remote URL through the Netlify function so CORS never blocks */
function viaProxy(u?: string | null): string | undefined {
  const raw = (u ?? "").toString().trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return undefined;
  return `/api/pdf-proxy?url=${encodeURIComponent(raw)}`;
}

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

// clamp description so it never pushes into footer (autoshrink helps too)
function clampDesc(s?: string, max = 420) {
  if (!s) return "";
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

// scale title size smoothly by length
function titleSize(name: string) {
  const n = name?.length ?? 0;
  if (n <= 28) return 28;
  if (n <= 36) return 26;
  if (n <= 52) return 24;
  if (n <= 64) return 22;
  return 20;
}

// robust getter for sheet headers (case & spacing insensitive)
function pick(obj: any, keys: string[], fallback = ""): string {
  for (const k of keys) {
    const direct = obj?.[k];
    if (direct != null && direct !== "") return String(direct);

    const low = obj?.[k.toLowerCase()];
    if (low != null && low !== "") return String(low);

    const nospc = obj?.[k.replace(/\s+/g, "")];
    if (nospc != null && nospc !== "") return String(nospc);
  }
  return fallback;
}

/* =========== MAIN EXPORTER =========== */
export async function exportDeckFromProducts({
  client,
  products,
}: {
  client: ClientInfo;
  products: Product[];
}) {
  const pptx = new PptxGenJS();
  (pptx as any).layout = "LAYOUT_16x9";

  // masters (ensure the PNGs exist in /public)
  pptx.defineSlideMaster({
    title: "COVER1",
    objects: [{ image: { path: "/cover-bg-1.png", x: 0, y: 0, w: 13.33, h: 7.5 } }],
  });
  pptx.defineSlideMaster({
    title: "COVER2",
    objects: [{ image: { path: "/cover-bg-2.png", x: 0, y: 0, w: 13.33, h: 7.5 } }],
  });
  pptx.defineSlideMaster({
    title: "END1",
    objects: [{ image: { path: "/end-bg-1.png", x: 0, y: 0, w: 13.33, h: 7.5 } }],
  });
  pptx.defineSlideMaster({
    title: "END2",
    objects: [{ image: { path: "/end-bg-2.png", x: 0, y: 0, w: 13.33, h: 7.5 } }],
  });
  pptx.defineSlideMaster({ title: "PRODUCT", background: { color: "FFFFFF" }, objects: [] });

  /* ---- COVER 1 ---- */
  {
    const s = pptx.addSlide({ masterName: "COVER1" });
    addTextBox(s, client.projectName || "Project Selection", {
      x: 0.8, y: 1.0, w: 11.5, h: 0.7,
      fontSize: 34, bold: true, color: COLOR_TEXT,
    });
    addTextBox(s, `Prepared for ${client.clientName || "Client"}`, {
      x: 0.8, y: 1.7, w: 11.5, h: 0.5, fontSize: 16, color: COLOR_SUB,
    });
    addTextBox(
      s,
      client.dateISO ? new Date(client.dateISO).toLocaleDateString() : new Date().toLocaleDateString(),
      { x: 0.8, y: 2.15, w: 11.5, h: 0.4, fontSize: 12, color: COLOR_MUTED }
    );
    // contact on cover 1 (optional)
    if (client.contactName || client.contactEmail || client.contactPhone) {
      addTextBox(s, client.contactName || "", { x: 0.8, y: 2.6, w: 11.5, h: 0.4, fontSize: 14 });
      const details = [client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
      addTextBox(s, details, { x: 0.8, y: 3.0, w: 11.5, h: 0.4, fontSize: 12, color: COLOR_SUB });
    }
  }

  /* ---- COVER 2 (contact focus) ---- */
  {
    const s = pptx.addSlide({ masterName: "COVER2" });
    addTextBox(s, client.projectName || "Project Selection", {
      x: 0.8, y: 1.0, w: 11.5, h: 0.7, fontSize: 28, bold: true,
    });
    addTextBox(s, client.contactName || "", { x: 0.8, y: 1.75, w: 11.5, h: 0.45, fontSize: 16, color: COLOR_SUB });
    const details = [client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
    addTextBox(s, details, { x: 0.8, y: 2.2, w: 11.5, h: 0.4, fontSize: 12, color: COLOR_MUTED });
  }

  /* ---- PRODUCT SLIDES ---- */
  for (const row of products) {
    const s = pptx.addSlide({ masterName: "PRODUCT" });

    // sheet aliases
    const name = pick(row as any, ["Name", "Product"]) || "Product";
    const code = pick(row as any, ["Code", "SKU", "Product Code"]);
    const imageUrl = pick(row as any, ["ImageURL", "Image Url", "Image", "Thumbnail", "imagebox"]);
    const pdfUrl = pick(row as any, ["PdfURL", "PDF URL", "Spec", "Specs", "SpecUrl", "SpecsUrl"]);
    const desc = clampDesc(pick(row as any, ["Description", "Product Description"]));

    // Title
    addTextBox(s, name, {
      ...LAYOUT.title,
      fontSize: titleSize(name),
      bold: true,
      align: "center",
    });

    // Left image
    if (imageUrl) {
      try {
        const data = await fetchAsDataUrl(imageUrl);
        s.addImage({
          data: stripPrefix(data),
          x: LAYOUT.img.x, y: LAYOUT.img.y, w: LAYOUT.img.w, h: LAYOUT.img.h,
          sizing: { type: "contain", w: LAYOUT.img.w, h: LAYOUT.img.h },
        });
      } catch (e) {
        // swallow; keep slide usable
        // console.warn("image fetch failed", imageUrl, e);
      }
    }

    // Right specs block: prefer first PDF page; otherwise bullets from "Specs"
    let drewSpecs = false;
    if (pdfUrl) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdfUrl)!, 1200);
        s.addImage({
          data: stripPrefix(png),
          x: LAYOUT.specs.x, y: LAYOUT.specs.y, w: LAYOUT.specs.w, h: LAYOUT.specs.h,
          sizing: { type: "contain", w: LAYOUT.specs.w, h: LAYOUT.specs.h },
        });
        drewSpecs = true;
      } catch {}
    }
    if (!drewSpecs) {
      const specsRaw = pick(row as any, ["Specs", "Specifications"], "");
      const bullets = specsRaw
        ? specsRaw.split(/\r?\n|,|•/).map((b) => b.trim()).filter(Boolean)
        : [];
      if (bullets.length) {
        addTextBox(
          s,
          bullets.map((b) => `• ${b}`).join("\n"),
          { x: LAYOUT.specs.x, y: LAYOUT.specs.y, w: LAYOUT.specs.w, h: LAYOUT.specs.h, fontSize: 12, color: COLOR_SUB }
        );
      }
    }

    // Description & Code (autoshrink inside fixed height)
    if (desc) {
      addTextBox(s, desc, {
        ...LAYOUT.desc,
        fontSize: 13,
        color: COLOR_SUB,
        align: "center",
      });
    }
    if (code) {
      addTextBox(s, code, { ...LAYOUT.code, fontSize: 12, color: COLOR_TEXT, align: "center" });
    }

    // Footer
    s.addShape((pptx as any).ShapeType.rect, {
      x: LAYOUT.footerBar.x, y: LAYOUT.footerBar.y, w: LAYOUT.footerBar.w, h: LAYOUT.footerBar.h,
      fill: { color: COLOR_FOOTER },
    });
    s.addImage({ path: "/logo.png", ...LAYOUT.footerLogo });
    addTextBox(s, "Pacific Bathroom · Project Selections", {
      ...LAYOUT.footerText, fontSize: 10, color: "FFFFFF", align: "left",
    });
  }

  // Blank end slides
  pptx.addSlide({ masterName: "END1" });
  pptx.addSlide({ masterName: "END2" });

  await pptx.writeFile({ fileName: `${client.projectName || "Project Selection"}.pptx` });
}