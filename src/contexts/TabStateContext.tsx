'use client';

import React, { createContext, useContext, useRef, ReactNode } from 'react';

interface TabStateCache {
  [tabId: string]: {
    [componentKey: string]: any;
  };
}

interface TabStateContextType {
  getTabState: <T>(tabId: string, key: string, defaultValue: T) => T;
  setTabState: <T>(tabId: string, key: string, value: T) => void;
  clearTabState: (tabId: string) => void;
  clearAllTabStates: () => void;
}

const TabStateContext = createContext<TabStateContextType | null>(null);

export function TabStateProvider({ children }: { children: ReactNode }) {
  const stateCache = useRef<TabStateCache>({});

  const getTabState = <T,>(tabId: string, key: string, defaultValue: T): T => {
    const tabState = stateCache.current[tabId];
    if (tabState && key in tabState) {
      return tabState[key] as T;
    }
    return defaultValue;
  };

  const setTabState = <T,>(tabId: string, key: string, value: T): void => {
    if (!stateCache.current[tabId]) {
      stateCache.current[tabId] = {};
    }
    stateCache.current[tabId][key] = value;
  };

  const clearTabState = (tabId: string): void => {
    delete stateCache.current[tabId];
  };

  const clearAllTabStates = (): void => {
    stateCache.current = {};
  };

  return (
    <TabStateContext.Provider value={{
      getTabState,
      setTabState,
      clearTabState,
      clearAllTabStates,
    }}>
      {children}
    </TabStateContext.Provider>
  );
}

export function useTabState() {
  const context = useContext(TabStateContext);
  if (!context) {
    throw new Error('useTabState must be used within a TabStateProvider');
  }
  return context;
}

// Hook personalizado para usar estado persistente de aba
export function usePersistedTabState<T>(
  tabId: string,
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const { getTabState, setTabState } = useTabState();
  
  const [state, setState] = React.useState<T>(() => 
    getTabState(tabId, key, initialValue)
  );

  const setPersistedState = React.useCallback((value: React.SetStateAction<T>) => {
    setState(prev => {
      const newValue = typeof value === 'function' ? (value as Function)(prev) : value;
      setTabState(tabId, key, newValue);
      return newValue;
    });
  }, [tabId, key, setTabState]);

  // Sincronizar com cache quando o estado muda
  React.useEffect(() => {
    setTabState(tabId, key, state);
  }, [tabId, key, state, setTabState]);

  return [state, setPersistedState];
}