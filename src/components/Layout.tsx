import React from 'react';

type Props = {
  children: React.ReactNode;
};

/**
 * Minimal layout wrapper.
 * Keeps things simple so it won’t fight with App.tsx.
 */
export default function Layout({ children }: Props) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
