/**
 * useSuppliesData Hook
 *
 * Gerencia busca e sincronização em tempo real de insumos e categorias do Firestore.
 * Implementa real-time listeners com onSnapshot para atualização automática.
 */

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import type { Supply, SupplyCategory } from '@/types';

const SUPPLIES_COLLECTION = 'supplies';
const SUPPLY_CATEGORIES_COLLECTION = 'supply_categories';

interface UseSuppliesDataResult {
  allSupplies: Supply[];
  categories: SupplyCategory[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook para carregar insumos e categorias do usuário
 *
 * @param userId - ID do usuário autenticado
 * @param onError - Callback opcional para tratamento de erro
 * @returns Dados de insumos, categorias e estado de loading
 */
export function useSuppliesData(
  userId: string | null,
  onError?: (message: string) => void
): UseSuppliesDataResult {
  const [allSupplies, setAllSupplies] = useState<Supply[]>([]);
  const [categories, setCategories] = useState<SupplyCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setAllSupplies([]);
      setCategories([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Query para categorias
      const qCategories = query(
        collection(db, SUPPLY_CATEGORIES_COLLECTION),
        where("userId", "==", userId),
        orderBy("name")
      );

      // Query para insumos
      const qSupplies = query(
        collection(db, SUPPLIES_COLLECTION),
        where("userId", "==", userId),
        orderBy("name")
      );

      // Listener em tempo real para categorias
      const unsubCategories = onSnapshot(
        qCategories,
        (snapshot) => {
          const fetchedCategories = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as SupplyCategory));
          setCategories(fetchedCategories);
        },
        (err) => {
          const errorMessage = `Erro ao carregar categorias: ${err.message}`;
          setError(errorMessage);
          if (onError) onError(errorMessage);
        }
      );

      // Listener em tempo real para insumos
      const unsubSupplies = onSnapshot(
        qSupplies,
        (snapshot) => {
          const fetchedSupplies = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Supply));
          setAllSupplies(fetchedSupplies);
          setIsLoading(false);
        },
        (err) => {
          const errorMessage = `Erro ao carregar insumos: ${err.message}`;
          setError(errorMessage);
          setIsLoading(false);
          if (onError) onError(errorMessage);
        }
      );

      // Cleanup: desinscrever dos listeners
      return () => {
        unsubCategories();
        unsubSupplies();
      };
    } catch (err: any) {
      const errorMessage = `Erro ao configurar listeners: ${err.message}`;
      setError(errorMessage);
      setIsLoading(false);
      if (onError) onError(errorMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return {
    allSupplies,
    categories,
    isLoading,
    error,
  };
}
