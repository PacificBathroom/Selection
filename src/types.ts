// src/types.ts

/** Information entered in the app (not in Google Sheets) */
export interface ClientInfo {
  projectName?: string;
  clientName?: string;
  dateISO?: string;

  contactName?: string;   // <- used on export slide
  contactEmail?: string;
  contactPhone?: string;
}

/** Core product shape coming from the spreadsheet */
export interface Product {
  // Primary fields from your sheet
  name?: string;             // <- "Name"
  description?: string;      // <- "Description"
  imageUrl?: string;         // <- "imageurl"
  pdfUrl?: string;           // <- "PDFUrl"
  code?: string;             // <- "Code"

  // Aliases / compatibility for existing UI code:
  product?: string;          // alias of name
  sku?: string;              // alias of code
  image?: string;            // alias of imageUrl
  thumbnail?: string;        // alias of imageUrl
  specPdfUrl?: string;       // alias of pdfUrl

  // Optional extra fields used by some components (safe, optional)
  category?: string;
  features?: string[];       // can be unused
  specifications?: string;   // freeform text alternative to PDF
  price?: string | number;
  sourceUrl?: string;

  // allow unknown extras without type errors
  [key: string]: any;
}

/** Logical grouping of products (if you use it elsewhere) */
export interface Section {
  title?: string;
  products?: Product[];
}

export type { ClientInfo as default };
