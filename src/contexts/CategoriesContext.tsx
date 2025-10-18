"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { db } from '@/lib/config/firebase';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import type { SupplyCategory } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const SUPPLY_CATEGORIES_COLLECTION = 'supply_categories';

interface CategoriesContextType {
  categories: SupplyCategory[];
  isLoadingCategories: boolean;
  errorCategories: string | null;
  refreshCategories: () => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined);

export const CategoriesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<SupplyCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [errorCategories, setErrorCategories] = useState<string | null>(null);
  const { toast } = useToast();

  const refreshCategories = useCallback(async () => {
    if (!user) {
      setCategories([]);
      setIsLoadingCategories(false);
      return;
    }

    setIsLoadingCategories(true);
    setErrorCategories(null);

    try {
      console.log('[CategoriesContext] Refreshing categories for user:', user.uid);
      // The real-time listener will handle the update
    } catch (error: any) {
      console.error("Error refreshing categories:", error);
      toast({ title: "Erro ao atualizar categorias", description: error.message, variant: "destructive" });
      setErrorCategories(error.message);
    } finally {
      setIsLoadingCategories(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!user) {
      console.log('[CategoriesContext] No user, clearing categories');
      setCategories([]);
      setIsLoadingCategories(false);
      return;
    }

    console.log('[CategoriesContext] Setting up real-time listener for user:', user.uid);
    setIsLoadingCategories(true);
    setErrorCategories(null);

    const q = query(
      collection(db, SUPPLY_CATEGORIES_COLLECTION),
      where('userId', '==', user.uid),
      orderBy('name')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log('[CategoriesContext] Received snapshot with', snapshot.docs.length, 'categories');
        const fetchedCategories: SupplyCategory[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as SupplyCategory));

        setCategories(fetchedCategories);
        setIsLoadingCategories(false);
        setErrorCategories(null);
      },
      (error) => {
        console.error('[CategoriesContext] Error loading categories:', error);
        toast({
          title: "Erro ao carregar categorias",
          description: error.message,
          variant: "destructive"
        });
        setErrorCategories(error.message);
        setIsLoadingCategories(false);
      }
    );

    return () => {
      console.log('[CategoriesContext] Cleaning up listener');
      unsubscribe();
    };
  }, [user, toast]);

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