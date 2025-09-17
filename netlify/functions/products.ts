// netlify/functions/products.ts
import type { Handler } from "@netlify/functions";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

/** rename your file to something without spaces for safety */
const FILE_NAME = "precero.xlsx"; // put the file at /public/assets/precero.xlsx

// Map common header names to the keys your app/exporter expect
const KEY_ALIASES: Record<string, string> = {
  url: "url",
  name: "name",
  code: "code",
  sku: "sku",
  category: "category",
  image: "image",
  imageurl: "imageUrl",
  thumbnail: "thumbnail",
  description: "description",
  pdfurl: "pdfUrl",
  "pdf url": "pdfUrl",
  specpdfurl: "specPdfUrl",
  specifications: "specifications",
  specs: "specs",
  specsbullets: "specs",        // your G column
};

function normalizeRow(row: any) {
  const out: any = {};
  for (const [kRaw, v] of Object.entries(row)) {
    const k = String(kRaw).trim();
    const keyNorm = KEY_ALIASES[k.toLowerCase()] || k;
    out[keyNorm] = v;
  }
  return out;
}

export const handler: Handler = async (event) => {
  try {
    const q = (event.queryStringParameters?.q || "").toLowerCase();
    const category = (event.queryStringParameters?.category || "").toLowerCase();

    const abs = path.join(process.cwd(), "public", "assets", FILE_NAME);
    if (!fs.existsSync(abs)) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: `Excel not found at ${abs}`,
      };
    }

    const wb = XLSX.readFile(abs, { cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];

    // normalize keys and filter
    let items = rawRows.map(normalizeRow);

    if (category) {
      items = items.filter((r) =>
        String(r.category || "").toLowerCase() === category
      );
    }

    if (q) {
      items = items.filter((r) => {
        const hay = [
          r.name,
          r.code,
          r.sku,
          r.category,
          r.description,
        ]
          .map((x) => String(x || "").toLowerCase())
          .join(" ");
        return hay.includes(q) || hay.indexOf(q) >= 0;
      });
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items }),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: String(e?.message || e),
    };
  }
};
