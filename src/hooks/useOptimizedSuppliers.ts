import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { usePerformanceMonitor } from '@/lib/utils/performanceMonitor';
import { FirestoreEmergencyHandler } from '@/lib/utils/firestoreEmergencyHandler';
import type { Fornecedor } from '@/types';

interface UseOptimizedSuppliersResult {
  suppliers: Fornecedor[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  clearCache: () => void;
}

export function useOptimizedSuppliers(userId: string | null): UseOptimizedSuppliersResult {
  const [suppliers, setSuppliers] = useState<Fornecedor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const performanceMonitor = usePerformanceMonitor();

  const getCacheKey = useCallback(() => `optimized-suppliers-${userId}`, [userId]);
  const getExpiryCacheKey = useCallback(() => `${getCacheKey()}-expiry`, [getCacheKey]);

  const clearCache = useCallback(() => {
    if (userId) {
      localStorage.removeItem(getCacheKey());
      localStorage.removeItem(getExpiryCacheKey());
    }
  }, [userId, getCacheKey, getExpiryCacheKey]);

  const fetchSuppliers = useCallback(async (useCache = true) => {
    if (!userId) {
      setSuppliers([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Verificar cache se permitido
    if (useCache) {
      const cachedData = localStorage.getItem(getCacheKey());
      const cacheExpiry = localStorage.getItem(getExpiryCacheKey());

      if (cachedData && cacheExpiry && Date.now() < parseInt(cacheExpiry)) {
        setSuppliers(JSON.parse(cachedData));
        setIsLoading(false);
        setError(null);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    // Iniciar monitoramento de performance
    const monitor = performanceMonitor.startQuery('suppliers-fetch', {
      userId,
      useCache,
      timestamp: new Date().toISOString()
    });

    // Timeout para detectar queries lentas
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ [useOptimizedSuppliers] Query demorou mais de 10 segundos - possível problema de performance');
    }, 10000);

    try {
      const q = query(
        collection(db, 'fornecedores'),
        where("userId", "==", userId),
        where("status", "==", "ativo"),
        orderBy("empresa")
      );

      const snapshot = await getDocs(q);
      clearTimeout(timeoutId);
      
      const fetchedSuppliers = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Fornecedor));

      setSuppliers(fetchedSuppliers);
      
      // Cache por 60 segundos
      localStorage.setItem(getCacheKey(), JSON.stringify(fetchedSuppliers));
      localStorage.setItem(getExpiryCacheKey(), (Date.now() + 60000).toString());
      
      // Finalizar monitoramento
      monitor.finish({
        count: fetchedSuppliers.length,
        success: true,
        fromCache: false
      });
      
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      console.error('❌ [useOptimizedSuppliers] Erro na busca:', {
        error: err.message,
        code: err.code,
        userId
      });

      let errorMessage = 'Erro ao carregar fornecedores';
      
      if (err.code === 'failed-precondition') {
        errorMessage = 'Índice do banco de dados não encontrado. Verifique o console para mais detalhes.';
      } else if (err.code === 'unavailable') {
        errorMessage = 'Problema de conectividade. Verifique sua conexão com a internet.';
      } else if (err.code === 'permission-denied') {
        errorMessage = 'Permissão negada. Verifique se você está logado corretamente.';
      }
      
      setError(errorMessage);
      
      // Finalizar monitoramento com erro
      monitor.finish({
        count: 0,
        success: false,
        error: err.message,
        errorCode: err.code
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, getCacheKey, getExpiryCacheKey, performanceMonitor]);

  const refetch = useCallback(() => {
    fetchSuppliers(false); // Force refresh sem cache
  }, [fetchSuppliers]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  return {
    suppliers,
    isLoading,
    error,
    refetch,
    clearCache
  };
}