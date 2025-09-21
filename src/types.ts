// src/types.ts
export interface Section {
  id?: string;
  title: string;        // required
  products: Product[];  // required
}

export type Product = {
  id: string;                 // stable id
  url?: string;
  code?: string;
  name?: string;
  imageUrl?: string;
  description?: string;
  specs?: string[];           // from SpecsBullets
  pdfUrl?: string;
  category?: string;

  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
};
 description?: string;
  specs?: string[];         // bullet points
  price?: number | null;    // optional numeric
};


  // media
  imageUrl?: string;
  image?: string;
  thumbnail?: string;

  // copy
  description?: string;

  // specs
  specs?: { label?: string; value?: string }[] | string;
  specifications?: string;

  // pdf/spec sheets
  pdfUrl?: string;
  specPdfUrl?: string;

  // category
  category?: string;

  // per-row contact (optional fallback for slides/UX)
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;

  // selection flag (if you use it)
  selected?: boolean;

  [key: string]: any; // keep flexible
}

export interface ClientInfo {
  projectName?: string;
  clientName?: string;
  dateISO?: string;

  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
}
