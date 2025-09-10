// src/components/SectionSlide.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Section, Product } from '../types';
import { renderPdfFirstPageToDataUrl } from '../utils/pdfPreview';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type Props = { section: Section; onUpdate: (next: Section) => void };

/** Route external assets (images/PDFs) through Netlify to avoid CORS/tainted canvas */
const viaProxy = (u?: string | null): string | undefined =>
  u ? `/api/pdf-proxy?url=${encodeURIComponent(u)}` : undefined;

/** Resolve relative URLs (e.g. "/wp-content/...") against a base */
function absUrl(u?: string | null, base?: string): string | undefined {
  if (!u) return undefined;
  try {
    return new URL(u, base || (typeof window !== 'undefined' ? window.location.href : undefined)).toString();
  } catch {
    return u || undefined;
  }
}

/** Clean ugly scraped text (remove obvious script/css noise and trim) */
function cleanText(input?: string | null, maxLen = 800): string | undefined {
  if (!input) return undefined;
  let s = String(input);

  // Drop common script blobs we see on WP pages
  s = s.replace(/window\._wpemojiSettings[\s\S]*?\};?/gi, ' ');
  s = s.replace(/\/\*![\s\S]*?\*\//g, ' '); // /*! ... */ banners
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' '); // if HTML slipped in
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  // Remove very long “words” (minified code/URLs)
  s = s.replace(/\S{120,}/g, ' ');
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();

  if (s.length > maxLen) s = s.slice(0, maxLen).trimEnd() + '…';
  return s || undefined;
}

// Small card for search results
function ResultCard({
  r,
  onPick,
}: {
  r: { title: string; url: string; image?: string };
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex items-center ga
