// src/types.ts

/** Information entered in the app (not from the spreadsheet) */
export interface ClientInfo {
  projectName?: string;
  clientName?: string;
  dateISO?: string;

  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

/** Unified product shape used everywhere in the app */
export interface Product {
  name?: string;          // ← Excel "Name"
  description?: string;   // ← Excel "Description"
  imageUrl?: string;      // ← Excel "ImageUrl"
  pdfUrl?: string;        // ← Excel "PDFUrl"
  code?: string;          // ← Excel "Code"
  category?: string;
  price?: string | number;
  specs?: string[];       // optional bullets if you ever add them
}

/** Logical grouping of products */
export interface Section {
  title?: string;
  products?: Product[];
}
