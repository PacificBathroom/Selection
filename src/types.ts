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

/** Product row (superset so existing components still compile) */
export interface Product {
  // Identifiers
  id?: string;
  code?: string;                 // Excel "Code"
  sku?: string;
  category?: string;

  // Display
  name?: string;                 // Excel "name"
  description?: string;          // Excel "Description"
  brand?: string;                // used by some components
  price?: string | number;       // used by some components

  // Media
  image?: string;
  imageUrl?: string;             // Excel "imageurl"
  thumbnail?: string;

  // Specs / docs
  pdfUrl?: string;               // Excel "PDFUrl"
  specPdfUrl?: string;
  /**
   * Some code expects string[]; your seed data sometimes uses
   * {label, value}. Support both to avoid compile errors.
   */
  specs?: Array<string | { label: string; value: string }>;
  specifications?: string;       // legacy single-string spec blob
  features?: string[];           // optional parsed bullets

  // Links / provenance
  sourceUrl?: string;

  /**
   * Legacy compatibility for code that does p.product?.field.
   * NOTE: React cannot render objects directly (e.g. {p.product}),
   * so components should read a field like p.product?.name.
   */
  product?: Product;

  // Allow unknown keys from spreadsheets
  [key: string]: any;
}

/** Optional grouping of products some views reference */
export interface Section {
  title?: string;
  products?: Product[];
  /** legacy alias */
  product?: Product;
}

/** Simple asset placeholder */
export interface Asset {
  url: string;
  type?: string;
}
