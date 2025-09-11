import { useId } from "react";

export type ProjectDetails = {
  projectName: string;
  clientName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  date: string; // dd/mm/yyyy
};

export default function ProjectDetailsCard({
  value,
  onChange,
  logoUrl = "/brand/logo.png",
}: {
  value: ProjectDetails;
  onChange: (next: ProjectDetails) => void;
  logoUrl?: string;
}) {
  const ids = {
    project: useId(),
    client: useId(),
    contact: useId(),
    email: useId(),
    phone: useId(),
    date: useId(),
  };

  const set = (patch: Partial<ProjectDetails>) =>
    onChange({ ...value, ...patch });

  return (
    <section
      style={{
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        border: "1px solid #eef2f7",
        padding: 20,
      }}
    >
      {/* Title row (like slide) */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0f172a" }}>
            Project Selection
          </h2>
          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
            Prepared for <strong>{value.clientName || "Client name"}</strong>
          </div>
        </div>
        <img src={logoUrl} alt="Logo" style={{ height: 28, objectFit: "contain", opacity: 0.9 }} />
      </div>

      {/* Form grid (2 columns like your slide) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 16,
        }}
      >
        <L label="Project name" htmlFor={ids.project}>
          <input
            id={ids.project}
            value={value.projectName}
            onChange={(e) => set({ projectName: e.target.value })}
            placeholder="Project Selection"
            style={inputStyle}
          />
        </L>

        <L label="Client name" htmlFor={ids.client}>
          <input
            id={ids.client}
            value={value.clientName}
            onChange={(e) => set({ clientName: e.target.value })}
            placeholder="Client name"
            style={inputStyle}
          />
        </L>

        <L label="Your name (contact)" htmlFor={ids.contact}>
          <input
            id={ids.contact}
            value={value.contactName}
            onChange={(e) => set({ contactName: e.target.value })}
            placeholder="Your Name"
            style={inputStyle}
          />
        </L>

        <L label="Date" htmlFor={ids.date}>
          <input
            id={ids.date}
            value={value.date}
            onChange={(e) => set({ date: e.target.value })}
            placeholder="dd/mm/yyyy"
            style={inputStyle}
            inputMode="numeric"
          />
        </L>

        <L label="Email" htmlFor={ids.email}>
          <input
            id={ids.email}
            type="email"
            value={value.contactEmail}
            onChange={(e) => set({ contactEmail: e.target.value })}
            placeholder="you@example.com"
            style={inputStyle}
          />
        </L>

        <L label="Phone" htmlFor={ids.phone}>
          <input
            id={ids.phone}
            value={value.contactPhone}
            onChange={(e) => set({ contactPhone: e.target.value })}
            placeholder="0000 000 000"
            style={inputStyle}
            inputMode="tel"
          />
        </L>
      </div>
    </section>
  );
}

function L({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#6b7280" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  outline: "none",
};
