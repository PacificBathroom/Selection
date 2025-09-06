# Precero Product Showcase App

Vite + React + TypeScript + TailwindCSS. Search-first UX with auto-slide details, Export to PDF, and a Netlify Function to import product data from **precero.com.au/product/** pages.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## Deploy (Netlify)

- Push to GitHub.
- Connect repo to Netlify.
- Ensure `netlify.toml` is at the repo root.

## Import from URL

Paste a full `https://www.precero.com.au/product/...` URL into the search bar and press **Enter**.
The imported product is added and the slide opens automatically.

## Export to PDF

Open a product slide and click **Export PDF**. The PDF includes your logo and the project/contact/date details.  
The **Date** defaults to **today** each new session (stored in `sessionStorage`, not `localStorage`).

## Tailwind

- `tailwind.config.js` and `postcss.config.js` included.
- Source CSS at `src/index.css` imports Tailwind layers.
