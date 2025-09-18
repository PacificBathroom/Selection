// src/types.ts

/** Info entered in the app (not from Sheets) */
export interface ClientInfo {
  projectName?: string;
  clientName?: string;
  dateISO?: string;

  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

/**
 * Product row as used across the app. Keep superset of fields the UI/export
 * may reference to avoid TS errors when some data is missing.
 */
export interface Product {
  // Names / identifiers
  name?: string;          // generic name
  product?: string;       // legacy alias many components use
  code?: string;          // generic code
  sku?: string;           // common alias

  // Categorization
  category?: string;
  brand?: string;

  // Display
  description?: string;
  features?: string[];    // bullet points

  // Media
  image?: string;         // direct URL
  imageUrl?: string;      // alias
  thumbnail?: string;     // alias for small image
  pdfUrl?: string;        // brochure/spec pdf
  specPdfUrl?: string;    // alias

  // Specs (structured or raw text)
  specs?: Array<{ label?: string; value?: string }> | string;
  specifications?: string;

  // Pricing
  price?: string | number;

  // Flexible extra keys from the sheet
  [key: string]: any;
}

/** Logical grouping */
export interface Section {
  title?: string;
  products?: Product[];
  /** legacy single product alias */
  product?: Product;
}

/** Asset placeholder */
export interface Asset {
  url: string;
  type?: string;
}

// convenient re-export
export type { ClientInfo as default };
