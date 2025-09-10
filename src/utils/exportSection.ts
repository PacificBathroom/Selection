import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { renderPdfFirstPageToDataUrl } from './pdfPreview';
import type { Section, Product } from '../types';

const px = (n: number) => `${n}px`;
const viaProxy = (u?: string | null) =>
  u ? (/^https?:\/\//i.test(u) ? `/api/pdf-proxy?url=${encodeURIComponent(u)}` : u) : undefined;

function makeSlide(product: Product) {
  const root = document.createElement('div');
  root.style.width = px(1000);            // fixed canvas for consistent export
  root.style.padding = px(24);
  root.style.background = '#fff';
  root.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';

  const row = document.createElement('div');
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '1fr 1fr';
  row.style.gap = px(24);

  // left: product image + spec pdf preview
  const left = document.createElement('div');

  if (product.image) {
    const img = document.createElement('img');
    img.src = viaProxy(product.image)!;
    img.crossOrigin = 'anonymous';
    img.style.width = '100%';
    img.style.border = '1px solid #e5e7eb';
    img.style.borderRadius = px(12);
    left.appendChild(img);
  }

  const right = document.createElement('div');

  // title
  const h3 = document.createElement('h3');
  h3.textContent = product.name || 'Selected product';
  h3.style.margin = '0 0 4px 0';
  right.appendChild(h3);

  if (product.sourceUrl) {
    const a = document.createElement('a');
    a.href = product.sourceUrl;
    a.textContent = product.sourceUrl;
    a.target = '_blank';
    a.style.wordBreak = 'break-all';
    a.style.color = '#2563eb';
    a.style.textDecoration = 'none';
    right.appendChild(a);
  }

  if (product.description) {
    const p = document.createElement('p');
    p.textContent = product.description;
    p.style.marginTop = px(8);
    right.appendChild(p);
  }

  // specs table if available
  if (Array.isArray(product.specs) && product.specs.length) {
    const h4 = document.createElement('h4');
    h4.textContent = 'Specifications';
    h4.style.margin = '16px 0 8px';
    right.appendChild(h4);

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.fontSize = '12px';
    table.style.borderCollapse = 'collapse';

    (product.specs as any[]).forEach((s: any) => {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      const td2 = document.createElement('td');
      td1.textContent = s.label ?? '';
      td2.textContent = s.value ?? String(s ?? '');
      td1.style.fontWeight = '600';
      td1.style.padding = '4px 8px 4px 0';
      td2.style.padding = '4px 0';
      tr.appendChild(td1);
      tr.appendChild(td2);
      table.appendChild(tr);
    });
    right.appendChild(table);
  }

  row.appendChild(left);
  row.appendChild(right);
  root.appendChild(row);

  // append to offscreen sandbox
  root.style.position = 'fixed';
  root.style.left = '-20000px';
  root.style.top = '0';
  document.body.appendChild(root);
  return root;
}

export async function exportSectionAsPdf(section: Section) {
  const products = section.products ?? (section.product ? [section.product as Product] : []);
  if (products.length === 0) return;

  const pdf = new jsPDF('p', 'mm', 'a4');
  let first = true;

  for (const p of products) {
    // If the product has a spec PDF, pre-render its first page and store in product for this render
    let specThumb: string | undefined;
    if (p.specPdfUrl) {
      try {
        specThumb = await renderPdfFirstPageToDataUrl(viaProxy(p.specPdfUrl)!, 1000);
      } catch {}
    }
    if (specThumb && !p.image) p.image = specThumb; // fallback image

    const slide = makeSlide(p);
    const canvas = await html2canvas(slide, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    slide.remove();

    const img = canvas.toDataURL('image/png');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW - 20;                // 10mm margins
    const imgH = (canvas.height * imgW) / canvas.width;

    if (!first) pdf.addPage();
    first = false;
    pdf.addImage(img, 'PNG', 10, Math.max(10, (pageH - imgH) / 2), imgW, Math.min(imgH, pageH - 20));
  }

  pdf.save(`${section.title || 'section'}.pdf`);
}
