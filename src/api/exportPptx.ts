// src/api/exportPptx.ts
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

// PDF.js worker (Vite ?url import)
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import * as pdfjsLib from "pdfjs-dist";
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

// Netlify proxy to bypass CORS for images/PDFs
const PROXY = (u: string) => `/api/pdf-proxy?url=${encodeURIComponent(u)}`;

// Turn remote file into data: URL (tries proxy first, then direct CORS fetch)
async function fetchAsDataUrl(url?: string): Promise<string | undefined> {
  try {
    if (!url) return undefined;
    const res = await fetch(PROXY(url));
    if (!res.ok) return undefined;
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result).split(",")[1];
        resolve(`data:${contentType};base64,${base64}`);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    try {
      const res = await fetch(url!, { mode: "cors" });
      if (!res.ok) return undefined;
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
    } catch {
      return undefined;
    }
  }
}

// Render first page of a PDF to a PNG data URL
async function pdfFirstPageToPng(pdfUrl?: string): Promise<string | undefined> {
  try {
    if (!pdfUrl) return undefined;
    const doc = await (pdfjsLib as any)
      .getDocument({ url: PROXY(pdfUrl), useSystemFonts: true })
      .promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1.35 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    canvas.width = viewpo
