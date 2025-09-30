"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { db } from '@/lib/config/firebase';
import { collection, onSnapshot, query, orderBy, getDocs, where } from 'firebase/firestore';
import type { SupplyCategory } from '@/types';
import { useToast } from '@/hooks/use-toast';

const SUPPLY_CATEGORIES_COLLECTION = 'supply_categories';

interface CategoriesContextType {
  categories: SupplyCategory[];
  isLoadingCategories: boolean;
  errorCategories: string | null;
  refreshCategories: () => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined);

export const CategoriesProvider = ({ children }: { children: ReactNode }) => {
  const [categories, setCategories] = useState<SupplyCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [errorCategories, setErrorCategories] = useState<string | null>(null);
  const { toast } = useToast();

  const refreshCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    setErrorCategories(null);
    try {
      // Simple implementation without user dependency for now
      setCategories([]);
    } catch (error: any) {
      console.error("Error refreshing categories:", error);
      toast({ title: "Erro ao atualizar categorias", description: error.message, variant: "destructive" });
      setErrorCategories(error.message);
    } finally {
      setIsLoadingCategories(false);
    }
  }, [toast]);

  useEffect(() => {
    // Initialize with empty categories for now
    setCategories([]);
    setIsLoadingCategories(false);
  }, []);

  return (
    <CategoriesContext.Provider value={{ categories, isLoadingCategories, errorCategories, refreshCategories }}>
      {children}
    </CategoriesContext.Provider>
  );
};

export const useCategories = (): CategoriesContextType => {
  const context = useContext(CategoriesContext);
  if (context === undefined) {
    throw new Error('useCategories must be used within a CategoriesProvider');
  }
  return context;
};