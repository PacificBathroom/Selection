/**
 * Pull assets (images/PDFs) referenced in a CSV and rewrite columns
 * to local paths under /assets/products/.
 *
 * Usage examples:
 *   node scripts/pullAssetsAndRewrite.js --in products.csv --out products-local.csv
 *   node scripts/pullAssetsAndRewrite.js --sheet "https://docs.google.com/spreadsheets/d/<ID>/export?format=csv&gid=<GID>" --out products-local.csv
 *
 * Optional flags:
 *   --dir public/assets/products         (download directory; defaults to this)
 *   --concurrency 5                      (parallel downloads; default 5)
 *   --force                              (re-download even if file exists)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const argv = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (!arg.startsWith("--")) return acc;
    const key = arg.replace(/^--/, "");
    const val = arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true;
    acc.push([key, val]);
    return acc;
  }, [])
);

const INPUT = argv.in || argv.sheet;
const OUTPUT = argv.out || "products-local.csv";
const OUT_DIR = argv.dir || path.join("public", "assets", "products");
const CONCURRENCY = Number(argv.concurrency || 5);
const FORCE = Boolean(argv.force);

if (!INPUT) {
  console.error(
    "Usage:\n  node scripts/pullAssetsAndRewrite.js --in products.csv --out products-local.csv\n  OR\n  node scripts/pullAssetsAndRewrite.js --sheet <published CSV url> --out products-local.csv"
  );
  process.exit(1);
}

// Ensure output dir exists
fs.mkdirSync(OUT_DIR, { recursive: true });

// Helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function sha1(s) {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);
}
function cleanFilename(name) {
  return name
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}
function guessExtFromContentType(ct = "") {
  ct = ct.toLowerCase();
  if (ct.includes("pdf")) return ".pdf";
  if (ct.includes("jpeg")) return ".jpg";
  if (ct.includes("jpg")) return ".jpg";
  if (ct.includes("png")) return ".png";
  if (ct.includes("gif")) return ".gif";
  if (ct.includes("webp")) return ".webp";
  return "";
}

async function readCsv(source) {
  let raw;
  if (argv.sheet) {
    const res = await fetch(source, { headers: { "User-Agent": "pb-scraper/1.0" } });
    if (!res.ok) throw new Error(`Failed to fetch sheet: ${res.status}`);
    raw = await res.text();
  } else {
    raw = fs.readFileSync(source, "utf8");
  }
  return parse(raw, { columns: true, skip_empty_lines: true });
}

function pick(obj, names) {
  // case-insensitive, allow space-less versions too
  for (const n of names) {
    if (obj[n] != null) return String(obj[n]).trim();
    const lower = n.toLowerCase();
    if (obj[lower] != null) return String(obj[lower]).trim();
    const tight = n.replace(/\s+/g, "");
    if (obj[tight] != null) return String(obj[tight]).trim();
    const tightLower = tight.toLowerCase();
    if (obj[tightLower] != null) return String(obj[tightLower]).trim();
  }
  return "";
}

function firstNonEmpty(...vals) {
  return vals.find((v) => v && String(v).trim() !== "") || "";
}

function urlToFilename(url, fallbackBase = "asset") {
  try {
    const u = new URL(url);
    const base = cleanFilename(path.basename(u.pathname)) || fallbackBase;
    if (path.extname(base)) return base;
    // No extension in URL: synthesize from content-type later
    return base;
  } catch {
    return cleanFilename(fallbackBase);
  }
}

async function download(url, outfile) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "pb-scraper/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  let final = outfile;

  // if outfile has no extension, try to add one from content-type
  if (!path.extname(final)) {
    const ext = guessExtFromContentType(ct);
    if (ext) final = `${outfile}${ext}`;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(final, buf);
  return { file: final, contentType: ct };
}

async function run() {
  const rows = await readCsv(INPUT);

  // Heuristics for column names
  const IMAGE_COLS = ["ImageURL", "Image Url", "Image", "Thumbnail"];
  const PDF_COLS = ["PdfURL", "PDF URL", "Specs PDF", "Spec", "SpecURL"];

  // Build a polite queue with limited concurrency
  let active = 0;
  const queue = [];
  const pushTask = (fn) =>
    new Promise((resolve, reject) => {
      queue.push(async () => {
        active++;
        try {
          const ret = await fn();
          resolve(ret);
        } catch (e) {
          reject(e);
        } finally {
          active--;
        }
      });
    });

  // Simple scheduler
  (async function scheduler() {
    while (queue.length) {
      if (active < CONCURRENCY) {
        const job = queue.shift();
        job();
      } else {
        await sleep(25);
      }
    }
  })();

  let downloads = 0;
  let skipped = 0;

  // Process rows
  for (const r of rows) {
    const name = firstNonEmpty(r.Name, r.Product, r.product, r.name, "item") || "item";
    const code = firstNonEmpty(r.Code, r.SKU, r.sku, r.code);
    const baseStem = cleanFilename(code || name || "item");

    // IMAGE
    const imgUrl = pick(r, IMAGE_COLS);
    if (imgUrl && /^https?:\/\//i.test(imgUrl)) {
      const fname = urlToFilename(imgUrl, `${baseStem}-img-${sha1(imgUrl)}`);
      const target = path.join(OUT_DIR, fname);

      if (!fs.existsSync(target) || FORCE) {
        await pushTask(async () => {
          try {
            fs.mkdirSync(path.dirname(target), { recursive: true });
            const { file } = await download(imgUrl, target);
            downloads++;
            // rewrite to site path
            r.ImageURL = `/assets/products/${path.basename(file)}`;
          } catch (e) {
            console.warn(`⚠️  Image download failed for ${imgUrl}: ${e.message}`);
          }
        });
      } else {
        skipped++;
        r.ImageURL = `/assets/products/${path.basename(target)}`;
      }
    }

    // PDF
    const pdfUrl = pick(r, PDF_COLS);
    if (pdfUrl && /^https?:\/\//i.test(pdfUrl)) {
      const fname = urlToFilename(pdfUrl, `${baseStem}-spec-${sha1(pdfUrl)}`);
      const target = path.join(OUT_DIR, fname);

      if (!fs.existsSync(target) || FORCE) {
        await pushTask(async () => {
          try {
            fs.mkdirSync(path.dirname(target), { recursive: true });
            const { file } = await download(pdfUrl, target);
            downloads++;
            r.PdfURL = `/assets/products/${path.basename(file)}`;
          } catch (e) {
            console.warn(`⚠️  PDF download failed for ${pdfUrl}: ${e.message}`);
          }
        });
      } else {
        skipped++;
        r.PdfURL = `/assets/products/${path.basename(target)}`;
      }
    }
  }

  // Wait for queue to finish
  while (active > 0 || queue.length > 0) {
    await sleep(50);
  }

  // Write CSV
  const csvOut = stringify(rows, { header: true });
  fs.writeFileSync(OUTPUT, csvOut);

  console.log(
    `\n✅ Done. Downloaded ${downloads} file(s), reused ${skipped}.`
  );
  console.log(`📄 Rewritten CSV saved to: ${OUTPUT}`);
  console.log(`📁 Assets directory:      ${OUT_DIR}\n`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
