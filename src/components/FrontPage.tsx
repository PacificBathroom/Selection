// src/components/FrontPage.tsx
import React from 'react';
import type { ClientInfo } from '../types';

export default function FrontPage({
  client,
  setClient,
}: {
  client: ClientInfo;
  setClient: (u: ClientInfo) => void;
}) {
  return (
    <section className="bg-white border rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-semibold">Project Selection</h1>
          <p className="text-xs text-slate-500">Prepared for <span className="font-medium">{client.clientName || 'Client name'}</span></p>
        </div>
        <img src="/logo.png" alt="Pacific Bathroom" className="h-10" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Project name</span>
          <input
            value={client.projectName || ''}
            onChange={(e) => setClient({ ...client, projectName: e.target.value })}
            placeholder="Project Selection"
            className="w-full border rounded px-2 py-1"
          />
        </label>

        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Client name</span>
          <input
            value={client.clientName || ''}
            onChange={(e) => setClient({ ...client, clientName: e.target.value })}
            placeholder="Client name"
            className="w-full border rounded px-2 py-1"
          />
        </label>

        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Date</span>
          <input
            type="date"
            value={client.dateISO || ''}
            onChange={(e) => setClient({ ...client, dateISO: e.target.value })}
            className="w-full border rounded px-2 py-1"
          />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Your name</span>
          <input
            value={client.contactName || ''}
            onChange={(e) => setClient({ ...client, contactName: e.target.value })}
            placeholder="Your Name"
            className="w-full border rounded px-2 py-1"
          />
        </label>

        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Email</span>
          <input
            value={client.contactEmail || ''}
            onChange={(e) => setClient({ ...client, contactEmail: e.target.value })}
            placeholder="you@example.com"
            className="w-full border rounded px-2 py-1"
          />
        </label>

        <label className="text-sm">
          <span className="block text-slate-600 mb-1">Phone</span>
          <input
            value={client.contactPhone || ''}
            onChange={(e) => setClient({ ...client, contactPhone: e.target.value })}
            placeholder="0000 000 000"
            className="w-full border rounded px-2 py-1"
          />
        </label>
      </div>
    </section>
  );
}
