import React, { useEffect } from 'react';
import logo from '../assets/logo.png';
import type { ClientInfo } from '../types';

type Props = {
  client: ClientInfo;
  setClient: (c: ClientInfo) => void;
};

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function FrontPage({ client, setClient }: Props) {
  useEffect(() => {
    const saved = localStorage.getItem('clientInfo');
    if (saved) setClient(JSON.parse(saved));
  }, [setClient]);

  useEffect(() => {
    localStorage.setItem('clientInfo', JSON.stringify(client));
  }, [client]);

  return (
    <div id="slide-front" className="bg-white rounded-2xl border shadow-card p-6">
      <div className="flex items-center justify-between border rounded-xl p-5 bg-slate-50">
        <div className="flex items-center gap-4">
          <img src={logo} alt="Pacific Bathroom" className="h-14 w-auto" />
          <div className="leading-tight">
            <input
              value={client.projectName ?? 'Project Selection'}
              onChange={e => setClient({ ...client, projectName: e.target.value })}
              className="text-2xl font-semibold border-b border-dashed bg-transparent focus:outline-none"
              aria-label="Project name"
            />
            <div className="text-slate-600 text-sm mt-1">
              <span>Prepared for </span>
              <input
                value={client.clientName}
                onChange={e => setClient({ ...client, clientName: e.target.value })}
                placeholder="Client name"
                className="border-b border-dashed bg-transparent focus:outline-none"
                aria-label="Client name"
              />
            </div>
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="text-slate-600">Date</div>
          <input
            type="date"
            value={client.dateISO || todayISO()}
            onChange={e => setClient({ ...client, dateISO: e.target.value })}
            className="border-b border-dashed bg-transparent focus:outline-none"
            aria-label="Date"
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="text-sm">
          <div className="text-slate-500 mb-1">Client Email</div>
          <input
            value={client.clientEmail ?? ''}
            onChange={e => setClient({ ...client, clientEmail: e.target.value })}
            placeholder="client@example.com"
            className="w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <div className="text-slate-500 mb-1">Client Phone</div>
          <input
            value={client.clientPhone ?? ''}
            onChange={e => setClient({ ...client, clientPhone: e.target.value })}
            placeholder="0000 000 000"
            className="w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <div className="text-slate-500 mb-1">Client Address</div>
          <input
            value={client.clientAddress ?? ''}
            onChange={e => setClient({ ...client, clientAddress: e.target.value })}
            placeholder="Street, Suburb, State"
            className="w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <div className="text-slate-500 mb-1">Site Address</div>
          <input
            value={client.siteAddress ?? ''}
            onChange={e => setClient({ ...client, siteAddress: e.target.value })}
            placeholder="Job site address"
            className="w-full rounded-lg border px-3 py-2"
          />
        </label>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold mb-2">Selection Summary</h3>
        <p className="text-slate-700 text-sm">
          Use the following pages to search and attach products for each area (Bathroom 1, Kitchen, Laundry, etc.).
          Export the entire selection as a PDF at any time.
        </p>
      </div>
    </div>
  );
}
