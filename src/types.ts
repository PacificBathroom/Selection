// src/types.ts

// Row shape used throughout the app (from Google Sheets)
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

// Basic asset type (some old components/exporters reference it)
export type Asset = {
  url?: string;
  name?: string;
  mime?: string;
  width?: number;
  height?: number;
  [k: string]: any;
};

// Top-of-page details card state
export type ClientInfo = {
  clientName: string;
  projectName: string;
  dateISO?: string;       // yyyy-mm-dd
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

// Keep a minimal Section so legacy files compile
// (older code accesses section.products and sometimes section.product)
export type Section = {
  id: string;
  title: string;
  products?: Product[];   // legacy modules read/write this
  product?: Product;      // some exporters reference a singular product
};
