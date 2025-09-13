// src/types.ts

/** Client/project details are entered in the app UI (not in Google Sheets). */
export type ClientInfo = {
  projectName?: string;     // e.g. "Project Selection" / job name
  clientName?: string;      // optional "Prepared for ..."
  dateISO?: string;         // yyyy-mm-dd from <input type="date">
  contactName?: string;     // your name (or the rep)
  contactEmail?: string;
  contactPhone?: string;
};

/**
 * A row from Google Sheets.
 * We keep this type flexible so ALL columns pass through untouched.
 * (pptExporter and ProductGallery will read columns like ImageURL, PdfURL, Specs, etc.)
 */
export type Product = {
  // Flexible index signature: allow any extra sheet columns.
  [key: string]: any;

  // Common/likely columns (all optional):
  Name?: string;                 // product name
  Product?: string;              // some sheets use "Product"
  Code?: string;                 // product code
  SKU?: string | number;         // sku
  Category?: string;             // "Category" or "category"
  category?: string;
  Description?: string;          // long/short description

  // Image fields
  ImageURL?: string;             // direct image url (preferred)
  Image?: string;                // alt naming
  Thumbnail?: string;            // small preview if provided
  imageurl?: string;             // lower-case variants are allowed via index signature

  // Specs / PDF fields
  PdfURL?: string;               // direct PDF link for specs (preferred)
  "PDF URL"?: string;            // sometimes with a space
  Specs?: string;                // bullet-style text (comma/newline/• separated)
  Specifications?: string;       // alt naming

  // Any other custom fields you’ve added in the sheet will still be available
  // thanks to the index signature above.
};

/** Back-compat alias that some files may import. */
export type ProductRow = Product;