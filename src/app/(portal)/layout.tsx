'use client';

import React from 'react';
import Header from '@/components/shared/Header';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <Header
        title="Portal do Fornecedor"
        description="Acesse suas cotações e ofertas"
        notificationContext="supplier"
      />
      <div className="p-4 md:p-6 lg:p-8">
        {children}
      </div>
    </main>
  );
}