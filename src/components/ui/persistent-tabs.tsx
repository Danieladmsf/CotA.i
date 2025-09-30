'use client';

import React, { ReactNode, useRef, useEffect } from 'react';

interface PersistentTabsContentProps {
  activeTab: string;
  children: ReactNode;
}

interface TabCache {
  [tabId: string]: {
    element: ReactNode;
    mounted: boolean;
  };
}

/**
 * Component que mantém as abas montadas para preservar o estado
 * Ao invés de desmontar componentes quando troca de aba, apenas os esconde
 */
export default function PersistentTabsContent({ activeTab, children }: PersistentTabsContentProps) {
  const tabCacheRef = useRef<TabCache>({});
  const mountedTabsRef = useRef<Set<string>>(new Set());

  // Processa os children e agrupa por tab
  const tabElements = React.Children.toArray(children).reduce((acc, child) => {
    if (React.isValidElement(child) && child.props.value) {
      const tabId = child.props.value;
      acc[tabId] = child;
      
      // Marca como montado se é a primeira vez ou se já foi ativa
      if (tabId === activeTab || mountedTabsRef.current.has(tabId)) {
        mountedTabsRef.current.add(tabId);
      }
    }
    return acc;
  }, {} as Record<string, ReactNode>);

  // Marca a aba ativa como montada
  useEffect(() => {
    if (activeTab && tabElements[activeTab]) {
      mountedTabsRef.current.add(activeTab);
    }
  }, [activeTab, tabElements]);

  return (
    <>
      {Object.entries(tabElements).map(([tabId, element]) => {
        const shouldMount = mountedTabsRef.current.has(tabId);
        const isActive = tabId === activeTab;
        
        if (!shouldMount) return null;

        return (
          <div
            key={tabId}
            style={{ 
              display: isActive ? 'block' : 'none',
              // Preserva o espaço quando escondido para evitar layout shifts
              visibility: isActive ? 'visible' : 'hidden',
              position: isActive ? 'relative' : 'absolute',
              width: isActive ? 'auto' : '100%',
              height: isActive ? 'auto' : '0',
              overflow: isActive ? 'visible' : 'hidden'
            }}
            data-tab-id={tabId}
            data-tab-active={isActive}
          >
            {element}
          </div>
        );
      })}
    </>
  );
}

/**
 * Hook para detectar se uma aba foi montada anteriormente
 */
export function useTabMountedState(tabId: string, activeTab: string) {
  const mountedRef = useRef(false);
  
  useEffect(() => {
    if (tabId === activeTab) {
      mountedRef.current = true;
    }
  }, [tabId, activeTab]);

  return mountedRef.current || tabId === activeTab;
}

/**
 * Componente wrapper para conteúdo de aba que só renderiza quando necessário
 */
export function LazyTabContent({ 
  tabId, 
  activeTab, 
  children, 
  fallback 
}: {
  tabId: string;
  activeTab: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const isMounted = useTabMountedState(tabId, activeTab);
  const isActive = tabId === activeTab;
  
  if (!isMounted) {
    return fallback || null;
  }
  
  return (
    <div
      style={{
        display: isActive ? 'block' : 'none'
      }}
      data-tab-content={tabId}
      data-active={isActive}
    >
      {children}
    </div>
  );
}