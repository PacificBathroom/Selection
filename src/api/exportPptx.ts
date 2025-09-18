// src/api/exportPptx.ts
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

// -------- PDF.js (one source of truth) --------
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import * as pdfjsLib from "pdfjs-dist";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

// Proxy helper (bypass CORS on images/PDFs)
const PROXY = (u: string) => `/api/pdf-proxy?url=${encodeURIComponent(u)}`;

// Convert a remote file to a data: URL via the proxy
async function fetchAsDataUrl(url?: string): Promise<string | undefined> {
  try {
    if (!url) return undefined;
    const res = await fetch(PROXY(url));
    if (!res.ok) return undefined;
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const b64 = await res.text(); // the proxy returns base64 body
    return `data:${contentType};base64,${b64}`;
  } catch {
    // final fallback: direct fetch (may fail on CORS; safe to ignore)
    try {
      const res = await fetch(url!, { mode: "cors"}
