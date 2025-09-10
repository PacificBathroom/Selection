// src/utils/pptExporter.ts
// Exports a PowerPoint deck: Cover + 1 slide per product (image left, details right)
// Then you can "Save as PDF" from PowerPoint / macOS Preview.

import type { ClientInfo, Section, Product } from '../types';

const theme = {
  brand: { r: 31, g: 106, b: 238 }, // brand-600
  gold:  { r: 197, g: 148, b: 21 }, // accent line
  text:  { r: 0, g: 0, b: 0 },
  sub:   { r: 90, g: 90, b: 90 },
};

const SLIDE_W = 10;       // PowerPoint default: 10in x 5.625in (16:9)
const SLIDE_H = 5.625;
const M = 0.6;            // outer margin (inches)

const viaProxy = (u?: string | null): string | undefined =>
  u ? (/^https?:\/\//i.test(u) ? `/api/pdf-proxy?url=${encodeURIComponent(u)}` : u) : undefined;

function absUrl(u?: string | null, base?: string): string | undefined {
  if (!u) return undefined;
  try {
    return new URL(u, base || (typeof window !== 'undefined' ? window.location.href : undefined)).toString();
  } catch {
    return u || undefined;
  }
}

function cleanText(s?: string | null, maxLen = 900) {
  if (!s) return undefined;
  let t = String(s)
    .replace(/window\._wpemojiSettings[\s\S]*?\};?/gi, ' ')
    .replace(/\/\*![\s\S]*?\*\//g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/\S{160,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > maxLen) t = t.slice(0, maxLen).trimEnd() + '…';
  return t || undefined;
}

type KV = { label: string; value: string };
function normalizeSpecs(specs: unknown): KV[] {
  if (!specs) return [];
  if (Array.isArray(specs)) {
    const arr = specs as any[];
    // case 1: [{label, value}]
    if (arr.every((x) => x && typeof x === 'object' && ('label' in x || 'value' in x))) {
      return arr
        .map((s) => ({ label: String(s.label ?? ''), value: String(s.value ?? '') }))
        .filter((x) => x.label || x.value);
    }
    // case 2: ["Label: Value", ...]
    if (arr.every((x) => typeof x === 'string')) {
      return (arr as string[]).map((line) => {
        const parts = String(line).split(':');
        if (parts.length >= 2) return { label: parts[0].trim(), value: parts.slice(1).join(':').trim() };
        return { label: '', value: line.trim() };
      }).filter((x) => x.label || x.value);
    }
  }
  // case 3: { key: value }
  if (specs && typeof specs === 'object') {
    return Object.entries(specs as Record<string, unknown>)
      .map(([k, v]) => ({ label: k, value: String(v ?? '') }))
      .filter((x) => x.label || x.value);
  }
  return [];
}

async function fetchDataUrl(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

async function measureImage(dataUrl?: string): Promise<{ w: number; h: number } | undefined> {
  if (!dataUrl) return undefined;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve(undefined);
    img.src = dataUrl;
  });
}

export async function exportDeckPptx({ client, sections }: { client: ClientInfo; sections: Section[] }) {
  // dynamic import to avoid ESM type headaches
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9'; // 10 x 5.625 inches

  // ========== COVER ==========
  {
    const s = pptx.addSlide();
    // top brand band
    s.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: SLIDE_W, h: 0.8,
      fill: theme.brand,
      line: { type: 'none' },
    });

    // logo (optional)
    const logoData = await fetchDataUrl('/logo.png');
    if (logoData) {
      s.addImage({ data: logoData, x: M, y: 0.12, w: 1.8, h: 1.08 });
    }

    // Title
    s.addText(client.projectName || 'Project Selection', {
      x: M, y: 1.4, w: SLIDE_W - 2*M, h: 0.8,
      fontFace: 'Helvetica', fontSize: 28, bold: true, color: '000000',
    });

    // gold divider
    s.addShape(pptx.ShapeType.line, {
      x: M, y: 2.25, w: SLIDE_W - 2*M, h: 0,
      line: { color: theme.gold, width: 3 },
    });

    // Meta
    const meta: string[] = [];
    if (client.clientName) meta.push(`Prepared for ${client.clientName}`);
    if (client.dateISO) meta.push(new Date(client.dateISO).toLocaleDateString());
    s.addText(meta.join('\n'), {
      x: M, y: 2.5, w: SLIDE_W - 2*M, h: 0.8,
      fontFace: 'Helvetica', fontSize: 14, color: '5A5A5A',
      valign: 'top',
    });

    // Contact block
    const cBits = [
      client.contactName ? `Contact: ${client.contactName}` : '',
      client.contactEmail ? `Email: ${client.contactEmail}` : '',
      client.contactPhone ? `Phone: ${client.contactPhone}` : '',
    ].filter(Boolean);
    if (cBits.length) {
      s.addText(cBits.join('\n'), {
        x: M, y: 3.1, w: 4.8, h: 1,
        fontFace: 'Helvetica', fontSize: 12, color: '5A5A5A',
      });
    }

    // Summary
    const totalProducts = sections.reduce((acc, sec) => acc + (sec.products?.length || 0), 0);
    s.addText(`${sections.length} section${sections.length === 1 ? '' : 's'} • ${totalProducts} product${totalProducts === 1 ? '' : 's'}`, {
      x: M, y: 4.3, w: SLIDE_W - 2*M, h: 0.4,
      fontFace: 'Helvetica', fontSize: 12, bold: true, color: '000000',
    });
  }

  // ========== PRODUCT SLIDES ==========
  for (const sec of sections) {
    const prods = sec.products || [];
    for (const p of prods) {
      const slide = pptx.addSlide();

      // section header
      slide.addText(sec.title || 'Section', {
        x: M, y: M - 0.2, w: SLIDE_W - 2*M, h: 0.4,
        fontFace: 'Helvetica', fontSize: 12, bold: true, color: '000000',
      });

      // left image area
      const imgAbs = absUrl(p.image, p.sourceUrl);
      const imgSrc = viaProxy(imgAbs);
      const imgData = await fetchDataUrl(imgSrc);
      if (imgData) {
        const measured = await measureImage(imgData);
        // max area for image:
        const boxW = (SLIDE_W / 2) - (M + 0.1);
        const boxH = SLIDE_H - (M + 0.6);
        let w = boxW, h = boxH;
        if (measured && measured.w && measured.h) {
          const ratio = measured.w / measured.h;
          if (boxW / boxH > ratio) {
            // fit to height
            h = boxH;
            w = h * ratio;
          } else {
            // fit to width
            w = boxW;
            h = w / ratio;
          }
        }
        slide.addImage({ data: imgData, x: M, y: M, w, h });
      } else {
        // placeholder box if no image
        slide.addShape(pptx.ShapeType.rect, {
          x: M, y: M, w: (SLIDE_W / 2) - (M + 0.1), h: SLIDE_H - (M + 0.6),
          fill: { color: 'F2F2F2' }, line: { color: 'DDDDDD' },
        });
        slide.addText('No image', {
          x: M, y: M + 0.3, w: 3.5, h: 0.4,
          fontFace: 'Helvetica', fontSize: 12, color: '888888',
        });
      }

      // right column start
      const RX = (SLIDE_W / 2) + 0.1;
      let y = M;

      // product title
      slide.addText(p.name || 'Product', {
        x: RX, y, w: SLIDE_W - RX - M, h: 0.4,
        fontFace: 'Helvetica', fontSize: 18, bold: true, color: '000000',
      });
      y += 0.5;

      // link + code
      if (p.sourceUrl) {
        slide.addText(p.sourceUrl, {
          x: RX, y, w: SLIDE_W - RX - M, h: 0.3,
          fontFace: 'Helvetica', fontSize: 10, color: '1F6AEE',
        });
        y += 0.35;
      }
      if (p.code) {
        slide.addText(p.code, {
          x: RX, y, w: SLIDE_W - RX - M, h: 0.3,
          fontFace: 'Helvetica', fontSize: 10, color: '5A5A5A',
        });
        y += 0.35;
      }

      // description
      const desc = cleanText(p.description);
      if (desc) {
        slide.addText(desc, {
          x: RX, y, w: SLIDE_W - RX - M, h: 1.2,
          fontFace: 'Helvetica', fontSize: 11, color: '000000',
          valign: 'top',
        });
        y += 1.25;
      }

      // features (bullets)
      if (p.features?.length) {
        slide.addText('Features', {
          x: RX, y, w: SLIDE_W - RX - M, h: 0.3,
          fontFace: 'Helvetica', fontSize: 12, bold: true, color: '000000',
        });
        y += 0.35;

        // show up to ~8 bullets to avoid overflow
        const maxBullets = 8;
        const items = p.features.slice(0, maxBullets).map((f) => `• ${f}`);
        slide.addText(items, {
          x: RX, y, w: SLIDE_W - RX - M, h: 1.6,
          fontFace: 'Helvetica', fontSize: 11, color: '000000',
          valign: 'top',
        });
        y += 1.7;
      }

      // specifications
      const specs = normalizeSpecs(p.specs);
      if (specs.length) {
        slide.addText('Specifications', {
          x: RX, y, w: SLIDE_W - RX - M, h: 0.3,
          fontFace: 'Helvetica', fontSize: 12, bold: true, color: '000000',
        });
        y += 0.35;

        // build a 2-col table: Label | Value
        const rows: (string | { text: string; options?: any })[][] = [];
        // header row
        rows.push([
          { text: 'Label',  options: { bold: true } },
          { text: 'Value',  options: { bold: true } },
        ]);
        for (const kv of specs.slice(0, 18)) {
          rows.push([kv.label || '', kv.value || '']);
        }

        slide.addTable(rows, {
          x: RX, y, w: SLIDE_W - RX - M,
          colW: [1.7, SLIDE_W - RX - M - 1.7],
          fontFace: 'Helvetica', fontSize: 10,
          border: { type: 'solid', color: 'DDDDDD', pt: 1 },
          fill: 'FFFFFF',
        });
      } else if (p.specPdfUrl) {
        // fallback: just show a link to the spec PDF if we couldn't parse structured specs
        slide.addText('Specifications:', {
          x: RX, y, w: SLIDE_W - RX - M, h: 0.3,
          fontFace: 'Helvetica', fontSize: 12, bold: true, color: '000000',
        });
        y += 0.35;
        slide.addText(p.specPdfUrl, {
          x: RX, y, w: SLIDE_W - RX - M, h: 0.3,
          fontFace: 'Helvetica', fontSize: 10, color: '1F6AEE',
        });
      }
    }
  }

  const fileName = `${(client.projectName || 'selection')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()}.pptx`;

  await pptx.writeFile({ fileName });
}
