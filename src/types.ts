export type Asset = {
  label?: string;
  href?: string;
  url?: string;
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
  brand?: string;
  tags?: string[];
  compliance?: string[];
  category?: string;

  // ⬇️ new: specification pdf detection + preview image
  specPdfUrl?: string;
  specPdfPreviewDataUrl?: string;
};

export type Section = {
  id: string;
  title: string;
  product?: Product;
};

export type ClientInfo = {
  projectName: string;
  clientName?: string;
  dateISO?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  jobDate?: string;
};
