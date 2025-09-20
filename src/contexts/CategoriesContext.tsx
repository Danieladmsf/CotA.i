
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { db } from '@/lib/config/firebase';
import { collection, onSnapshot, query, orderBy, getDocs, where } from 'firebase/firestore';
import type { SupplyCategory } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthContext'; // Import useAuth

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
  const { user, loading: authLoading } = useAuth(); // Get user from AuthContext

  const fetchCategoriesAndSetupListener = useCallback(async (userId: string) => {
    setIsLoadingCategories(true);
    setErrorCategories(null);
    const qCategories = query(
      collection(db, SUPPLY_CATEGORIES_COLLECTION), 
      where("userId", "==", userId),
      orderBy("name")
    );
    
    try {
      // Setup the listener
      const unsubscribe = onSnapshot(qCategories, (snapshot) => {
          const fetchedCategories: SupplyCategory[] = snapshot.docs.map(docSnap => ({
              id: docSnap.id,
              ...docSnap.data()
          } as SupplyCategory));
          setCategories(fetchedCategories);
          setIsLoadingCategories(false);
          setErrorCategories(null); 
      }, (error) => {
          console.error("Error fetching categories via listener:", error);
          toast({ title: "Erro ao carregar categorias", description: error.message, variant: "destructive" });
          setErrorCategories(error.message);
          setIsLoadingCategories(false);
      });
      return unsubscribe;
    } catch (error: any) {
        console.error("Error setting up category listener:", error);
        toast({ title: "Erro ao configurar categorias", description: error.message, variant: "destructive" });
        setErrorCategories(error.message);
        setIsLoadingCategories(false);
        return () => {}; // Return a no-op unsubscribe function on error
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return; // Wait for authentication to resolve

    if (user) {
      const unsubscribePromise = fetchCategoriesAndSetupListener(user.uid);
      return () => {
        unsubscribePromise.then(unsub => unsub && unsub());
      };
    } else {
      // No user, clear categories and stop loading
      setCategories([]);
      setIsLoadingCategories(false);
    }
  }, [user, authLoading, fetchCategoriesAndSetupListener]);
  
  const refreshCategories = useCallback(async () => {
    if (!user) return; // Can't refresh without a user
    setIsLoadingCategories(true);
    setErrorCategories(null);
    try {
      const qCategories = query(
        collection(db, SUPPLY_CATEGORIES_COLLECTION), 
        where("userId", "==", user.uid),
        orderBy("name")
      );
      const snapshot = await getDocs(qCategories);
      const fetchedCategories: SupplyCategory[] = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
      } as SupplyCategory));
      setCategories(fetchedCategories);
    } catch (error: any) {
      console.error("Error refreshing categories:", error);
      toast({ title: "Erro ao atualizar categorias", description: error.message, variant: "destructive" });
      setErrorCategories(error.message);
    } finally {
      setIsLoadingCategories(false);
    }
  }, [toast, user]);

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
