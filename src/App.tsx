// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import type { Product } from "./types";
import { fetchProducts } from "./lib/products";
import { exportPptx } from "./api/exportPptx";
// ...
const onExport = () =>
  exportPptx(selectedList, { projectName, clientName, contactName, email, phone, date });


// small helpers
const includes = (h: string, n: string) => h.toLowerCase().includes(n.toLowerCase());
const title = (s?: string) => (s ?? "").trim() || "—";

export default function App() {
  // load products from Google Sheets
  const [items, setItems] = useState<Product[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const ps = await fetchProducts("Products!A:Z");
        setItems(ps);
      } catch (e: any) {
        setErr(e?.message || "fetch error");
      }
    })();
  }, []);

  // selection
  const keyOf = (p: Product) => (p.code || p.name || "") + "::" + (p.url || "");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const toggle = (p: Product) => setSelected(s => ({ ...s, [keyOf(p)]: !s[keyOf(p)] }));
  const selectedList = useMemo(
    () => (items ?? []).filter(p => selected[keyOf(p)]),
    [items, selected]
  );

  // filters
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState<"sheet" | "name">("sheet");

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const p of items ?? []) if (p.category) s.add(p.category);
    return ["All", ...Array.from(s).sort()];
  }, [items]);

  const visible = useMemo(() => {
    let a = [...(items ?? [])];
    if (q) {
      a = a.filter(
        p =>
          includes(p.name ?? "", q) ||
          includes(p.code ?? "", q) ||
          includes(p.description ?? "", q) ||
          includes(p.category ?? "", q)
      );
    }
    if (cat !== "All") a = a.filter(p => p.category === cat);
    if (sort === "name") a.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return a;
  }, [items, q, cat, sort]);

  // header form (meta used by export)
  const [projectName, setProjectName] = useState("Project Selection");
  const [clientName, setClientName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");

  // export button handler
  const onExport = () =>
    exportPptx(selectedList, { projectName, clientName, contactName, email, phone, date });

  return (
    <div className="wrap">
      <h1>Product Selection</h1>

      {/* top form */}
      <div className="card form">
        <div className="grid2">
          <label>
            <div>Project name</div>
            <input
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="Project Selection"
            />
          </label>
          <label>
            <div>Client name</div>
            <input
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Client name"
            />
          </label>
        </div>
        <div className="grid2">
          <label>
            <div>Your name (contact)</div>
            <input
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="Your Name"
            />
          </label>
          <label>
            <div>Date</div>
            <input
              value={date}
              onChange={e => setDate(e.target.value)}
              placeholder="dd/mm/yyyy"
            />
          </label>
        </div>
        <div className="grid2">
          <label>
            <div>Email</div>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            <div>Phone</div>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="0000 000 000"
            />
          </label>
        </div>
      </div>

      {/* toolbar */}
      <div className="toolbar">
        <input
          className="search"
          placeholder="Search products, SKU, description..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <select
          className="categorySelect"
          style={{ maxWidth: 260 }}
          value={cat}
          onChange={e => setCat(e.target.value)}
        >
          {categories.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as any)}>
          <option value="sheet">Sheet order</option>
          <option value="name">Name (A–Z)</option>
        </select>
        <div className="spacer" />
        <div className="muted">Selected: {selectedList.length}</div>
        <button className="primary" onClick={onExport}>
          Export PPTX
        </button>
      </div>

      {/* status */}
      {err && <p className="error">Error: {err}</p>}
      {!items && !err && <p>Loading…</p>}

      {/* product grid */}
      <div className="grid">
        {(visible ?? []).map((p, i) => {
          const k = keyOf(p);
          const isSel = !!selected[k];
          return (
            <div className={"card product" + (isSel ? " selected" : "")} key={k + i}>
              <label className="checkbox">
                <input type="checkbox" checked={isSel} onChange={() => toggle(p)} />
              </label>

              <div className="thumb">
                {p.imageProxied ? (
                  <img src={p.imageProxied} alt={p.name || p.code || "product"} />
                ) : (
                  <div className="ph">No image</div>
                )}
              </div>

              <div className="body">
                <div className="name">{title(p.name)}</div>
                {p.code && <div className="sku">SKU: {p.code}</div>}

                {p.description && <p className="desc">{p.description}</p>}

                {p.specsBullets && p.specsBullets.length > 0 && (
                  <ul className="specs">
                    {p.specsBullets.slice(0, 4).map((s, j) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ul>
                )}

                <div className="links">
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer">
                      Product page
                    </a>
                  )}
                  {p.pdfUrl && (
                    <a
                      href={`/api/pdf-proxy?url=${encodeURIComponent(p.pdfUrl)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Spec sheet (PDF)
                    </a>
                  )}
                </div>

                {p.category && <div className="category">Category: {p.category}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
