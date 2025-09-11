import React, { useId } from "react";
import type { ClientInfo } from "../types";

type Props = {
  client: ClientInfo;
  setClient: (next: ClientInfo) => void;
  logoUrl?: string;
};

export default function ProjectDetailsCard({ client, setClient, logoUrl = "/logo.png" }: Props) {
  const ids = {
    project: useId(),
    client: useId(),
    contact: useId(),
    email: useId(),
    phone: useId(),
    date: useId(),
  };
  const on = (k: keyof ClientInfo) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setClient({ ...client, [k]: e.target.value });

  return (
    <section className="bg-white rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] border border-slate-100 p-5">
      {/* Title row, like your Google Slide */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[22px] font-bold text-slate-900">Project Selection</h2>
          <div className="mt-1 text-xs text-slate-500">
            Prepared for <strong>{client.clientName || "Client name"}</strong>
          </div>
        </div>
        <img src={logoUrl} alt="Logo" className="h-7 opacity-90" />
      </div>

      {/* 2-column grid of inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        <Label htmlFor={ids.project} text="Project name">
          <input
            id={ids.project}
            className={inputCls}
            placeholder="Project Selection"
            value={client.projectName || ""}
            onChange={on("projectName")}
          />
        </Label>

        <Label htmlFor={ids.client} text="Client name">
          <input
            id={ids.client}
            className={inputCls}
            placeholder="Client name"
            value={client.clientName || ""}
            onChange={on("clientName")}
          />
        </Label>

        <Label htmlFor={ids.contact} text="Your name (contact)">
          <input
            id={ids.contact}
            className={inputCls}
            placeholder="Your Name"
            value={client.contactName || ""}
            onChange={on("contactName")}
          />
        </Label>

        <Label htmlFor={ids.date} text="Date">
          {/* use your existing dateISO field (type=date for easy picking) */}
          <input
            id={ids.date}
            type="date"
            className={inputCls}
            value={client.dateISO || ""}
            onChange={on("dateISO")}
          />
        </Label>

        <Label htmlFor={ids.email} text="Email">
          <input
            id={ids.email}
            type="email"
            className={inputCls}
            placeholder="you@example.com"
            value={client.contactEmail || ""}
            onChange={on("contactEmail")}
          />
        </Label>

        <Label htmlFor={ids.phone} text="Phone">
          <input
            id={ids.phone}
            inputMode="tel"
            className={inputCls}
            placeholder="0000 000 000"
            value={client.contactPhone || ""}
            onChange={on("contactPhone")}
          />
        </Label>
      </div>
    </section>
  );
}

function Label({
  htmlFor,
  text,
  children,
}: {
  htmlFor: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="grid gap-1">
      <span className="text-xs text-slate-500">{text}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400";
