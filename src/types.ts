// src/types.ts

export type Asset = {
  label?: string;
  href?: string; // optional but present so a.href compiles
};

export type Spec = {
  label: string;
  value: string;
};

export type Product = {
  id: string;
  name: string;
  code?: string;
  description?: string;
  image?: string;
  gallery?: string[];
  features?: string[];
  specs?: Spec[];
  price?: string;
  assets?: Asset[];
  sourceUrl?: string;
};

export type Section = {
  id: string;
  title: string;
  // leave undefined when empty; don't use null
  product?: Product;
};

export type ClientInfo = {
  projectName: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  jobDate?: string; // ISO YYYY-MM-DD
};
