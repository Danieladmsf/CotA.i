'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseTabDataOptions<T> {
  tabId: string;
  fetchData: () => Promise<T> | T;
  dependencies?: any[];
  cacheTime?: number; // tempo em ms para manter cache
  refetchOnTabSwitch?: boolean;
}

/**
 * Hook que gerencia dados de aba com cache inteligente
 * Evita recarregamentos desnecessários quando o usuário troca de abas
 */
export function useTabData<T>({
  tabId,
  fetchData,
  dependencies = [],
  cacheTime = 5 * 60 * 1000, // 5 minutos padrão
  refetchOnTabSwitch = false
}: UseTabDataOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);
  
  const cacheRef = useRef<{
    data: T | null;
    timestamp: number;
    dependencies: any[];
  }>({
    data: null,
    timestamp: 0,
    dependencies: []
  });
  
  const isTabActiveRef = useRef(false);
  const fetchPromiseRef = useRef<Promise<T> | null>(null);

  // Verifica se o cache ainda é válido
  const isCacheValid = useCallback(() => {
    const now = Date.now();
    const cache = cacheRef.current;
    
    // Verifica se o cache expirou
    if (now - cache.timestamp > cacheTime) {
      return false;
    }
    
    // Verifica se as dependências mudaram
    if (cache.dependencies.length !== dependencies.length) {
      return false;
    }
    
    for (let i = 0; i < dependencies.length; i++) {
      if (cache.dependencies[i] !== dependencies[i]) {
        return false;
      }
    }
    
    return cache.data !== null;
  }, [dependencies, cacheTime]);

  // Função para buscar dados
  const loadData = useCallback(async (force = false) => {
    // Se já tem um fetch em andamento, aguarda ele
    if (fetchPromiseRef.current && !force) {
      try {
        const result = await fetchPromiseRef.current;
        return result;
      } catch (error) {
        // Se der erro, continua para fazer novo fetch
      }
    }

    // Verifica cache se não é força
    if (!force && isCacheValid()) {
      const cachedData = cacheRef.current.data as T;
      setData(cachedData);
      setIsLoading(false);
      setError(null);
      return cachedData;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Cria promise para evitar múltiplas requisições simultâneas
      const fetchPromise = Promise.resolve(fetchData());
      fetchPromiseRef.current = fetchPromise;
      
      const result = await fetchPromise;
      
      // Atualiza cache
      cacheRef.current = {
        data: result,
        timestamp: Date.now(),
        dependencies: [...dependencies]
      };
      
      setData(result);
      setLastFetch(Date.now());
      setIsLoading(false);
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao carregar dados');
      setError(error);
      setIsLoading(false);
      throw error;
    } finally {
      fetchPromiseRef.current = null;
    }
  }, [fetchData, dependencies, isCacheValid]);

  // Refresh manual dos dados
  const refresh = useCallback(() => {
    return loadData(true);
  }, [loadData]);

  // Marcar aba como ativa
  const setTabActive = useCallback((active: boolean) => {
    isTabActiveRef.current = active;
    
    // Se a aba ficou ativa e deve refetch, recarrega
    if (active && refetchOnTabSwitch && !isCacheValid()) {
      loadData();
    }
  }, [refetchOnTabSwitch, isCacheValid, loadData]);

  // Carregamento inicial
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Limpa cache quando componente é desmontado
  useEffect(() => {
    return () => {
      fetchPromiseRef.current = null;
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    refresh,
    setTabActive,
    lastFetch: new Date(lastFetch),
    isCacheValid: isCacheValid()
  };
}

/**
 * Hook para detectar quando uma aba se torna ativa
 */
export function useTabVisibility(tabId: string, activeTab: string) {
  const [isVisible, setIsVisible] = useState(tabId === activeTab);
  const [hasBeenVisible, setHasBeenVisible] = useState(tabId === activeTab);
  
  useEffect(() => {
    const newIsVisible = tabId === activeTab;
    setIsVisible(newIsVisible);
    
    if (newIsVisible && !hasBeenVisible) {
      setHasBeenVisible(true);
    }
  }, [tabId, activeTab, hasBeenVisible]);

  return {
    isVisible,
    hasBeenVisible,
    isFirstTime: isVisible && !hasBeenVisible
  };
}

/**
 * Hook para preservar estado de scroll entre abas
 */
export function useTabScrollPosition(tabId: string, activeTab: string) {
  const scrollPositions = useRef<Map<string, number>>(new Map());
  
  useEffect(() => {
    const handleScroll = () => {
      if (tabId === activeTab) {
        scrollPositions.current.set(tabId, window.scrollY);
      }
    };

    if (tabId === activeTab) {
      // Restaura posição quando aba fica ativa
      const savedPosition = scrollPositions.current.get(tabId) || 0;
      if (savedPosition > 0) {
        window.scrollTo(0, savedPosition);
      }
      
      // Adiciona listener para salvar posição
      window.addEventListener('scroll', handleScroll, { passive: true });
      
      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [tabId, activeTab]);

  return {
    savePosition: () => {
      scrollPositions.current.set(tabId, window.scrollY);
    },
    restorePosition: () => {
      const savedPosition = scrollPositions.current.get(tabId) || 0;
      window.scrollTo(0, savedPosition);
    }
  };
}