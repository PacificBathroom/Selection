// src/components/FrontPage.tsx
import React, { useEffect, useState } from 'react';
import type { ClientInfo } from '../types';

type Props = {
  client: ClientInfo;
  setClient: (c: ClientInfo) => void;
};

export default function FrontPage({ client, setClient }: Props) {
  return (
    <section className="bg-white rounded-xl border shadow-sm p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Logo + Titles */}
        <div className="space-y-2 min-w-0">
          {/* Project title (editable) */}
          <EditableInline
            value={client.projectName || 'Project Selection'}
            onCommit={(v) => setClient({ ...client, projectName: v })}
            inputClass="text-2xl md:text-3xl font-semibold text-gray-900"
            placeholder="Project title"
            ariaLabel="Project title"
          />

          {/* Subtitle: Prepared for Client name (editable) */}
          <div className="text-gray-600">
            Prepared for{' '}
            <EditableInline
              asSpan
              value={client.clientName || 'Client name'}
              onCommit={(v) => setClient({ ...client, clientName: v })}
              inputClass="font-medium text-gray-800"
              placeholder="Client name"
              ariaLabel="Client name"
            />
          </div>
        </div>

        {/* Right: Date picker */}
        <div className="shrink-0 text-sm text-gray-700">
          <label className="block text-gray-500 mb-1">Date</label>
          <input
            type="date"
            value={client.dateISO ?? ''}
            onChange={(e) => setClient({ ...client, dateISO: e.target.value })}
            className="rounded-lg border px-2 py-1"
            aria-label="Project date"
          />
        </div>
      </div>

      {/* Optional contact row (shows only if you add values later) */}
      {(client.contactName || client.contactEmail || client.contactPhone) && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          {client.contactName && (
            <ReadonlyField label="Your Name" value={client.contactName} />
          )}
          {client.contactEmail && (
            <ReadonlyField label="Email" value={client.contactEmail} />
          )}
          {client.contactPhone && (
            <ReadonlyField label="Phone" value={client.contactPhone} />
          )}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------- */
/* Small helpers                       */
/* ---------------------------------- */

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/**
 * Inline, click-to-edit text.
 * - Double-click or click the edit button to edit
 * - Enter/blur commits, Escape cancels
 */
function EditableInline({
  value,
  onCommit,
  placeholder = '',
  inputClass = '',
  ariaLabel,
  asSpan = false,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  inputClass?: string;
  ariaLabel?: string;
  asSpan?: boolean; // render inline like "Prepared for [Client]"
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const v = draft.trim() || placeholder || 'Untitled';
    onCommit(v);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`border rounded px-2 py-1 ${inputClass}`}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    );
  }

  const Tag: any = asSpan ? 'span' : 'div';
  return (
    <Tag className={`${inputClass} group inline-flex items-center gap-2`}>
      <span
        className={asSpan ? 'cursor-text' : 'cursor-text block'}
        onDoubleClick={() => setEditing(true)}
        title="Double-click to edit"
      >
        {value || placeholder}
      </span>
      <button
        type="button"
        className="opacity-0 group-hover:opacity-100 text-xs text-slate-600 hover:text-blue-600 underline"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${ariaLabel || 'text'}`}
      >
        Edit
      </button>
    </Tag>
  );
}
