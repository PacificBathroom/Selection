// src/types.ts

export interface Section {
  id?: string;
  title: string;        // required
  products: Product[];  // required
}

export type Product = {
  id: string;                 // stable id

  // core fields
  url?: string;
  code?: string;
  name?: string;
  category?: string;

  // media
  imageUrl?: string;          // from ImageURL
  image?: string;             // optional legacy field
  thumbnail?: string;         // optional

  // copy
  description?: string;

  // specs
  specs?: string[] | { label?: string; value?: string }[];
  specifications?: string;    // optional text fallback

  // pdf/spec sheets
  pdfUrl?: string;
  specPdfUrl?: string;

  // pricing (optional)
  price?: number | null;

  // contact block (from columns or per-row)
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;

  // selection flag (if used in UI)
  selected?: boolean;

  // allow extension
  [key: string]: any;
};

export interface ClientInfo {
  projectName?: string;
  clientName?: string;
  dateISO?: string;

  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
}
