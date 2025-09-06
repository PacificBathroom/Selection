import React from 'react';
type Props = { children: React.ReactNode };
export default function Tag({ children }: Props) {
  return <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{children}</span>;
}
