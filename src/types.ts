// src/types.ts

/** Information entered in the app (not in Excel) */
export interface ClientInfo {
  projectName?: string;
  clientName?: string;
  dateISO?: string;

  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

/** A single product row from Excel */
export interface Product {
  // Identifiers
  id?: string;
  code?: string;       // maps from Excel "Code"
  sku?: string;
  category?: string;

  // Display
  name?: string;       // Excel "name"
  description?: string; // Excel "Description"
  features?: string[]; // optional future "SpecsBullets" -> bullets

  // Media
  image?: string;
  imageUrl?: string;   // Excel "imageurl"
  thumbnail?: string;

  // Specs / docs
  pdfUrl?: string;     // Excel "PDFUrl"
  specPdfUrl?: string;
}

/** Optional grouping of products (if you use sections) */
export interface Section {
  title?: string;
  products?: Product[];

  /** legacy alias — some code may still expect this */
  product?: Product;
}

/** Simple asset placeholder (keep if you reference it elsewhere) */
export interface Asset {
  url: string;
  type?: string;
}
