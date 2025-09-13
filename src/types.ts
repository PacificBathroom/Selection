// src/types.ts

/** Information entered in the app (not in Google Sheets) */
export interface ClientInfo {
  projectName?: string;
  clientName?: string;
  dateISO?: string;

  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

/** A single product row from Google Sheets */
export interface Product {
  // Basic identifiers
  id?: string;
  name?: string;
  code?: string;
  sku?: string;
  category?: string;

  // Display / marketing
  description?: string;
  features?: string[];

  // Media
  image?: string;       // direct URL to product image
  imageUrl?: string;    // alias
  thumbnail?: string;   // alias
  specPdfUrl?: string;  // direct PDF link
  pdfUrl?: string;      // alias

  // Specs (structured or raw text)
  specs?: Array<{ label?: string; value?: string }> | string;
  specifications?: string;
  price?: string | number;

  // Any extra dynamic keys from the sheet
  [key: string]: any;
}

/**
 * Logical grouping of products.
 * Older code sometimes referred to a single `product` instead of an array.
 */
export interface Section {
  title?: string;
  products?: Product[];

  /** legacy alias — some code may still expect this */
  product?: Product;
}

/** Asset placeholder (kept for compatibility, can extend if needed) */
export interface Asset {
  url: string;
  type?: string;
}

export type { ClientInfo as default };