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

/** A single product row from Excel (superset to stay compatible with existing code) */
export interface Product {
  // Identifiers
  id?: string;
  code?: string;            // Excel "Code"
  sku?: string;
  category?: string;

  // Display / marketing
  name?: string;            // Excel "name"
  description?: string;     // Excel "Description"
  brand?: string;           // used by some components
  price?: string | number;  // used by some components

  // Media
  image?: string;
  imageUrl?: string;        // Excel "imageurl"
  thumbnail?: string;

  // Specs / docs
  pdfUrl?: string;          // Excel "PDFUrl"
  specPdfUrl?: string;
  specs?: string[];         // some utils expect this
  specifications?: string;  // legacy single-string

  // Links / provenance
  sourceUrl?: string;

  // Legacy/compat for places that expect nested "product"
  product?: Product;

  // Extra
  features?: string[];

  // Allow unknown keys from sheets
  [key: string]: any;
}

/** Optional grouping of products (some code references this) */
export interface Section {
  title?: string;
  products?: Product[];
  /** legacy alias */
  product?: Product;
}

/** Simple asset placeholder (keep if referenced elsewhere) */
export interface Asset {
  url: string;
  type?: string;
}
