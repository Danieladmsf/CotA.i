// src/components/shared/providers.tsx
'use client';

import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { CategoriesProvider } from '@/contexts/CategoriesContext';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CategoriesProvider>
        {children}
        <Toaster />
      </CategoriesProvider>
    </AuthProvider>
  );
}