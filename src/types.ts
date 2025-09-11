// src/types.ts

// Row shape coming from Google Sheets (used by gallery/section UIs)
export type Product = {
  product?: string;
  sku?: string;
  price?: number | string;
  category?: string;
  thumbnail?: string;
  description?: string;
  client_name?: string;
  pdf_url?: string;
  [k: string]: any;
};

// Top-of-page details card state
export type ClientInfo = {
  clientName: string;
  projectName: string;
  dateISO?: string;       // yyyy-mm-dd for <input type="date" />
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

// Minimal section type (kept so older modules/imports compile)
export type Section = {
  id: string;
  title: string;
};
