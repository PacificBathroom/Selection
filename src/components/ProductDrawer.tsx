import React, { useRef } from 'react';
import type { Product, Asset } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type Props = {
  product?: Product; // can be undefined when closed
  onClose: () => void;
};

export default function ProductDrawer({ product, onClose }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Guard: if no product, don’t render anything
  if (!product) {
    return null;
  }

  // From this point onward, TS knows `product` is defined
  const p: Product = product;

  async function exportPDF() {
    const node = contentRef.current;
    if (!node) return;
    const canvas = await html2canvas(node, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / c*
