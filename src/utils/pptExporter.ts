// src/utils/pptExporter.ts
// Build a PowerPoint deck with a cover + one slide per product.
// Then save as PDF from PowerPoint/Preview for a pixel-clean result.

import type { ClientInfo, Section, Product } from '../types';

const theme = {
  brand: { r: 31, g: 106, b: 238 }, // brand-600
  gold: { r: 197, g: 148, b: 21 },
};

const SLIDE_W = 10;      // 16:9 (10 x 5.625")
const SLIDE_H = 5.625;
const M = 0.6;

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
    if (arr.every((x) => x && typeof x === 'object' && ('label' in x || 'value' in x))) {
      return arr.map((s) => ({ label: String(s.label ?? ''), value: String(s.value ?? '') }))
                .filter((x) => x.label || x.value);
    }
    if (arr.every((x) => typeof x === 'string')) {
      return (arr as string[]).map((line) => {
        const parts = String(line).split(':');
        if (parts.length >= 2) return { label: parts[0].trim(), value: parts.slice(1).join(':').trim() };
        return { label: '', value: line.trim() };
      }).filter((x) => x.label || x.value);
    }
  }
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

async function drawCover(pptx: any, client: ClientInfo, sections: Section[]) {
  const s = pptx.addSlide();

  // Brand band (top)
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: 0.9,
    fill: theme.brand,
    line: { type: 'none' },
  });

  // Logo on right of band
  const logoData = await fetchDataUrl('/logo.png');
  if (logoData) {
    s.addImage({ data: logoData, x: SLIDE_W - (M + 2.0), y: 0.12, w: 1.9, h: 1.14 });
  }

  // Big centered title
  const title = client.projectName || 'Project Selection';
  s.addText(title, {
    x: M, y: 1.45, w: SLIDE_W - 2*M, h: 0.9,
    fontFace: 'Helvetica', fontSize: 30, bold: true, color: '000000',
    align: 'center',
  });

  // Thick gold divider
  s.addShape(pptx.ShapeType.line, {
    x: M + 0.6, y: 2.45, w: SLIDE_W - 2*(M + 0.6), h: 0,
    line: { color: theme.gold, width: 4 },
  });

  // Meta (centered)
  const meta: string[] = [];
  if (client.clientName) meta.push(`Prepared for ${client.clientName}`);
  if (client.dateISO) meta.push(new Date(client.dateISO).toLocaleDateString());
  s.addText(meta.join('\n'), {
    x: M, y: 2.75, w: SLIDE_W - 2*M, h: 0.9,
    fontFace: 'Helvetica', fontSize: 14, color: '5A5A5A',
    align: 'center', valign: 'top',
  });

  // Contact (centered)
  const cBits = [
    client.contactName ? `Contact: ${client.contactName}` : '',
    client.contactEmail ? `Email: ${client.contactEmail}` : '',
    client.contactPhone ? `Phone: ${client.contactPhone}` : '',
  ].filter(Boolean);
  if (cBits.length) {
    s.addText(cBits.join('\n'), {
      x: M, y: 3.6, w: SLIDE_W - 2*M, h: 1,
      fontFace: 'Helvetica', fontSize: 12, color: '5A5A5A',
      align: 'center',
    });
  }

  // Summary (bottom)
  const totalProducts = sections.reduce((acc, sec) => acc + (sec.products?.length || 0), 0);
  s.addText(
    `${sections.length} section${sections.length === 1 ? '' : 's'} • ${totalProducts} product${totalProducts === 1 ? '' : 's'}`,
    {
      x: M, y: SLIDE_H - 0.9, w: SLIDE_W - 2*M, h: 0.4,
      fontFace: 'Helvetica', fontSize: 12, bold: true, color: '000000',
      align: 'center',
    }
  );
}

export async function exportDeckPptx({ client, sections }: { client: ClientInfo; sections: Section[] }) {
  const PptxGenJS: any = (await import('pptxgenjs')).default;
  const pptx: any = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  // COVER
  await drawCover(pptx, client, sections);

  // PRODUCT SLIDES
  for (const sec of sections) {
    const prods = sec.products || [];
    for (const p of prods) {
      const slide = pptx.addSlide();

      // section header
      slide.addText(sec.title || 'Section', {
        x: M, y: M - 0.2, w: SLIDE_W - 2*M, h: 0.4,
        fontFace: 'Helvetica', fontSize: 12, bold: true, color: '000000',
      });

      // left image box
      const imgAbs = absUrl(p.image, p.sourceUrl);
      const imgSrc = viaProxy(imgAbs);
      const imgData = await fetchDataUrl(imgSrc);
      if (imgData) {
        const measured = await measureImage(imgData);
        const boxW = (SLIDE_W / 2) - (M + 0.1);
        const boxH = SLIDE_H - (M + 0.6);
        let w = boxW, h = boxH;
        if (measured && measured.w && measured.h) {
          const ratio = measured.w / measured.h;
          if (boxW / boxH > ratio) { h = boxH; w = h * ratio; }
          else { w = boxW; h = w / ratio; }
        }
        slide.addImage({ data: imgData, x: M, y: M, w, h });
      } else {
        slide.addShape(pptx.ShapeType.rect, {
          x: M, y: M, w: (SLIDE_W / 2) - (M + 0.1), h: SLIDE_H - (M + 0.6),
          fill: { color: 'F2F2F2' }, line: { color: 'DDDDDD' },
        });
        slide.addText('No image', {
          x: M, y: M + 0.3, w: 3.5, h: 0.4,
          fontFace: 'Helvetica', fontSize: 12, color: '888888',
        });
      }

      // right column
      const RX = (SLIDE_W / 2) + 0.1;
      let y = M;

      slide.addText(p.name || 'Product', {
        x: RX, y, w: SLIDE_W - RX - M, h: 0.4,
        fontFace: 'Helvetica', fontSize: 18, bold: true, color: '000000',
      });
      y += 0.5;

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

      const desc = cleanText(p.description);
      if (desc) {
        slide.addText(desc, {
          x: RX, y, w: SLIDE_W - RX - M, h: 1.2,
          fontFace: 'Helvetica', fontSize: 11, color: '000000',
          valign: 'top',
        });
        y += 1.25;
      }

      if (p.features?.length) {
        slide.addText('Features', {
          x: RX, y, w: SLIDE_W - RX - M, h: 0.3,
          fontFace: 'Helvetica', fontSize: 12, bold: true, color: '000000',
        });
        y += 0.35;
        const items = p.features.slice(0, 8).map((f) => `• ${f}`);
        slide.addText(items, {
          x: RX, y, w: SLIDE_W - RX - M, h: 1.6,
          fontFace: 'Helvetica', fontSize: 11, color: '000000',
          valign: 'top',
        });
        y += 1.7;
      }

      const specs = normalizeSpecs(p.specs);
      if (specs.length) {
        slide.addText('Specifications', {
          x: RX, y, w: SLIDE_W - RX - M, h: 0.3,
          fontFace: 'Helvetica', fontSize: 12, bold: true, color: '000000',
        });
        y += 0.35;

        const rows: (string | { text: string; options?: any })[][] = [];
        rows.push([{ text: 'Label', options: { bold: true } }, { text: 'Value', options: { bold: true } }]);
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
        slide.addText('Specifications', {
          x: RX, y, w: SLIDE_W - RX - M, h: 0.3,
          fontFace: 'Helvetica', fontSize: 12, bold: true, color: '000000',
        });
        y += 0.35;
        slide.addText(p.specPdfUrl, {
          x: RX, y, w: SLIDE_W - RX - M,_
