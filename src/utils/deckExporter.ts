// src/utils/deckExporter.ts
import jsPDF from 'jspdf';
import type { ClientInfo, Section, Product } from '../types';

const A4_W = 210; // mm
const A4_H = 297;
const MARGIN = 14;

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

function cleanText(s?: string | null, maxLen = 800) {
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
  if (Array.isArray(specs) && specs.every((x) => x && typeof x === 'object' && ('label' in (x as any) || 'value' in (x as any)))) {
    return (specs as any[]).map((s) => ({ label: String((s as any).label ?? ''), value: String((s as any).value ?? '') }))
      .filter((x) => x.label || x.value);
  }
  if (Array.isArray(specs) && specs.every((x) => typeof x === 'string')) {
    return (specs as string[]).map((line) => {
      const parts = String(line).split(':');
      if (parts.length >= 2) return { label: parts[0].trim(), value: parts.slice(1).join(':').trim() };
      return { label: '', value: line.trim() };
    }).filter((x) => x.label || x.value);
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
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

function mm(pdf: jsPDF, text: string, x: number, y: number, maxW: number, fontSize = 11) {
  pdf.setFontSize(fontSize);
  const lines = pdf.splitTextToSize(text, maxW);
  pdf.text(lines, x, y);
  const h = (lines.length * fontSize * 0.3528) * 1.15; // rough line height in mm
  return y + h;
}

async function drawCover(pdf: jsPDF, client: ClientInfo, sections: Section[]) {
  const cx = MARGIN;
  let y = MARGIN + 10;

  // Logo
  const logoData = await fetchDataUrl('/logo.png');
  if (logoData) {
    const w = 40;
    const h = 40 * 0.6;
    pdf.addImage(logoData, 'PNG', cx, y, w, h);
    y += h + 8;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.text(client.projectName || 'Project Selection', cx, y);
  y += 12;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  if (client.clientName) y = mm(pdf, `Prepared for ${client.clientName}`, cx, y, 120, 12);
  if (client.dateISO)    y = mm(pdf, new Date(client.dateISO).toLocaleDateString(), cx, y, 120, 12);

  y += 6;
  const totalProducts = sections.reduce((acc, s) => acc + (s.products?.length || 0), 0);
  pdf.setTextColor(100);
  mm(pdf, `${sections.length} sections • ${totalProducts} product${totalProducts === 1 ? '' : 's'}`, cx, y, 150, 10);
  pdf.setTextColor(0);

  // Footer
  pdf.setFontSize(9);
  pdf.text('Built with React + Tailwind  •  Exported from Pacific Bathroom Selection', cx, A4_H - MARGIN);
}

async function drawProductSlide(pdf: jsPDF, sectionTitle: string, p: Product) {
  const leftX = MARGIN;
  const rightX = A4_W / 2 + 2;
  let yLeft = MARGIN + 10;
  let yRight = MARGIN + 10;

  // Header
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text(sectionTitle, MARGIN, MARGIN);

  // Image (large, left)
  const imgAbs = absUrl(p.image, p.sourceUrl);
  const imgSrc = viaProxy(imgAbs);
  const imgData = await fetchDataUrl(imgSrc);
  if (imgData) {
    const w = A4_W / 2 - (MARGIN + 2);
    const h = w * 0.75; // keep decent aspect
    pdf.addImage(imgData, 'JPEG', leftX, yLeft, w, h, undefined, 'FAST');
    yLeft += h + 6;
  }

  // Title + link (right)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(p.name || 'Product', rightX, yRight);
  yRight += 8;

  if (p.sourceUrl) {
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(46, 88, 148);
    yRight = mm(pdf, p.sourceUrl, rightX, yRight, A4_W - rightX - MARGIN, 10);
    pdf.setTextColor(0);
  }

  if (p.code) {
    pdf.setFontSize(10);
    pdf.setTextColor(100);
    pdf.text(p.code, rightX, yRight);
    yRight += 6;
    pdf.setTextColor(0);
  }

  // Description
  const desc = cleanText(p.description);
  if (desc) {
    pdf.setFont('helvetica', 'normal');
    yRight = mm(pdf, desc, rightX, yRight + 2, A4_W - rightX - MARGIN, 11);
  }

  // Features
  if (p.features?.length) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Features', rightX, yRight + 6);
    yRight += 10;
    pdf.setFont('helvetica', 'normal');
    for (const f of p.features) {
      const bullet = '• ' + f;
      yRight = mm(pdf, bullet, rightX, yRight, A4_W - rightX - MARGIN, 11);
    }
  }

  // Specifications table
  const specs = normalizeSpecs(p.specs);
  if (specs.length) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Specifications', rightX, yRight + 6);
    yRight += 8;
    pdf.setFont('helvetica', 'normal');
    const labelW = 35;
    const colW = A4_W - rightX - MARGIN;
    for (const kv of specs) {
      const label = (kv.label || '').trim();
      const value = (kv.value || '').trim();
      // label
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(label, rightX, yRight, { maxWidth: labelW });
      // value
      pdf.setFont('helvetica', 'normal');
      const wrapped = pdf.splitTextToSize(value, colW - labelW - 2);
      pdf.text(wrapped, rightX + labelW + 2, yRight);
      yRight += Math.max(5, wrapped.length * 4.5);
      if (yRight > A4_H - MARGIN - 15) break; // simple overflow guard
    }
  }
}

export async function exportDeckPdf({ client, sections }: { client: ClientInfo; sections: Section[] }) {
  const pdf = new jsPDF('p', 'mm', 'a4');

  // COVER
  await drawCover(pdf, client, sections);

  // SLIDES (one per product)
  for (const s of sections) {
    const prods = s.products || [];
    for (let i = 0; i < prods.length; i++) {
      pdf.addPage();
      await drawProductSlide(pdf, s.title || 'Section', prods[i]);
    }
  }

  const fileName = `${(client.projectName || 'selection')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()}.pdf`;

  pdf.save(fileName || 'selection.pdf');
}
