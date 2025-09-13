// src/types.ts

/** Client/project details live in the app UI (not in Google Sheets). */
export type ClientInfo = {
  projectName?: string;
  clientName?: string;
  dateISO?: string;       // yyyy-mm-dd
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

/**
 * A row from Google Sheets. Keep flexible so ALL columns pass through untouched.
 * pptExporter / ProductGallery read fields like ImageURL, PdfURL, Specs, etc.
 */
export type Product = {
  [key: string]: any;

  // common, optional fields:
  Name?: string;
  Product?: string;
  Code?: string;
  SKU?: string | number;
  Category?: string;
  category?: string;
  Description?: string;

  // image fields
  ImageURL?: string;
  Image?: string;
  Thumbnail?: string;
  imageurl?: string;

  // specs/pdf
  PdfURL?: string;
  "PDF URL"?: string;
  Specs?: string;
  Specifications?: string;
};

/** Back-compat alias that some files may import. */
export type ProductRow = Product;

/** SHIMS for legacy components still importing these: */
export type Asset = {
  id: string;
  url: string;
  kind?: "image" | "pdf" | "link";
  title?: string;
};

export type Section = {
  id: string;
  title?: string;
  products?: any[]; // keep loose to avoid cascading refactors
};