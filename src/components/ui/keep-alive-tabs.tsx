'use client';

import React, { useState, useEffect, useRef, ReactNode } from 'react';

interface KeepAliveTabsProps {
  activeTab: string;
  children: ReactNode;
}

/**
 * Componente que mantém todas as abas montadas, apenas alternando visibilidade
 * Isso preserva o estado e evita recarregamentos desnecessários
 */
export default function KeepAliveTabs({ activeTab, children }: KeepAliveTabsProps) {
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set([activeTab]));

  // Monta a aba ativa
  useEffect(() => {
    setMountedTabs(prev => new Set([...prev, activeTab]));
  }, [activeTab]);

  return (
    <div className="keep-alive-tabs">
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child) || !child.props.value) {
          return child;
        }

        const tabId = child.props.value;
        const isActive = tabId === activeTab;
        const shouldMount = mountedTabs.has(tabId);

        if (!shouldMount) {
          return null;
        }

        // Clona o elemento com props modificadas para controlar visibilidade
        return React.cloneElement(child, {
          ...child.props,
          style: {
            display: isActive ? 'block' : 'none',
            ...child.props.style
          },
          'data-tab-active': isActive,
          'data-tab-id': tabId
        });
      })}
    </div>
  );
}

/**
 * Hook para detectar quando uma aba específica está ativa
 */
export function useTabActive(tabId: string, activeTab: string) {
  const wasActive = useRef(false);
  const isActive = tabId === activeTab;

  useEffect(() => {
    if (isActive) {
      wasActive.current = true;
    }
  }, [isActive]);

  return {
    isActive,
    wasActive: wasActive.current,
    isFirstTime: isActive && !wasActive.current
  };
}

/**
 * Componente alternativo usando Radix UI Tabs mas com keep-alive
 */
export function KeepAliveTabsContent({ value, activeTab, children, className, ...props }: {
  value: string;
  activeTab: string;
  children: ReactNode;
  className?: string;
  [key: string]: any;
}) {
  const [hasBeenActive, setHasBeenActive] = useState(value === activeTab);
  const isActive = value === activeTab;

  useEffect(() => {
    if (isActive && !hasBeenActive) {
      setHasBeenActive(true);
    }
  }, [isActive, hasBeenActive]);

  // Só renderiza se já foi ativa pelo menos uma vez
  if (!hasBeenActive) {
    return null;
  }

  return (
    <div
      className={className}
      style={{
        display: isActive ? 'block' : 'none'
      }}
      data-state={isActive ? 'active' : 'inactive'}
      data-tab-content={value}
      {...props}
    >
      {children}
    </div>
  );
}