'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/shared/Header';
import { HeaderActionsProvider } from '@/contexts/HeaderActionsContext';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Extract supplierId from pathname (e.g., /portal/[supplierId]/...)
  const supplierIdMatch = pathname?.match(/\/portal\/([^\/]+)/);
  const supplierId = supplierIdMatch?.[1];

  return (
    <HeaderActionsProvider>
      <main>
        <Header
          title="Portal do Fornecedor"
          description="Acesse suas cotações e ofertas"
          notificationContext="supplier"
          supplierId={supplierId}
        />
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </HeaderActionsProvider>
  );
}