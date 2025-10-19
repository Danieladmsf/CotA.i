"use client";

import React, { createContext, useContext, useRef, useCallback, type ReactNode } from 'react';

interface HeaderActionsContextType {
  actionsRef: React.MutableRefObject<ReactNode>;
  notifyChange: () => void;
  subscribe: (callback: () => void) => () => void;
}

const HeaderActionsContext = createContext<HeaderActionsContextType | undefined>(undefined);

export const HeaderActionsProvider = ({ children }: { children: ReactNode }) => {
  const actionsRef = useRef<ReactNode>(null);
  const listenersRef = useRef<Set<() => void>>(new Set());

  const subscribe = useCallback((callback: () => void) => {
    listenersRef.current.add(callback);
    return () => {
      listenersRef.current.delete(callback);
    };
  }, []);

  const notifyChange = useCallback(() => {
    listenersRef.current.forEach(listener => listener());
  }, []);

  const value = useRef({ actionsRef, notifyChange, subscribe }).current;

  return (
    <HeaderActionsContext.Provider value={value}>
      {children}
    </HeaderActionsContext.Provider>
  );
};

// Hook básico para acessar o contexto
const useHeaderActionsContext = (): HeaderActionsContextType => {
  const context = useContext(HeaderActionsContext);
  if (context === undefined) {
    throw new Error('useHeaderActions must be used within a HeaderActionsProvider');
  }
  return context;
};

// Hook para componentes que DEFINEM ações
export const useSetHeaderActions = () => {
  const { actionsRef, notifyChange } = useHeaderActionsContext();

  return useCallback((actions: ReactNode) => {
    actionsRef.current = actions;
    notifyChange();
  }, [actionsRef, notifyChange]);
};

// Hook para o Header que LÊ as ações
export const useHeaderActions = () => {
  const { actionsRef, subscribe } = useHeaderActionsContext();
  const [, forceUpdate] = React.useState({});

  React.useEffect(() => {
    return subscribe(() => forceUpdate({}));
  }, [subscribe]);

  return actionsRef.current;
};
