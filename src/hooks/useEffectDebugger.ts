/**
 * Hook para debugar useEffect e detectar loops infinitos
 *
 * @example
 * useEffectDebugger(() => {
 *   // seu código
 * }, [dep1, dep2], 'MyComponent');
 */

import { useEffect, useRef } from 'react';

export function useEffectDebugger(
  effect: React.EffectCallback,
  deps: React.DependencyList,
  debugLabel: string = 'useEffect'
) {
  const renderCount = useRef(0);
  const prevDeps = useRef<React.DependencyList>(deps);
  const effectCount = useRef(0);

  // Detectar qual dependência mudou
  useEffect(() => {
    renderCount.current += 1;

    const changedDeps = deps.reduce<Record<number, { before: any; after: any }>>(
      (acc, dep, index) => {
        if (dep !== prevDeps.current[index]) {
          acc[index] = {
            before: prevDeps.current[index],
            after: dep,
          };
        }
        return acc;
      },
      {}
    );

    if (Object.keys(changedDeps).length > 0) {
      effectCount.current += 1;
      console.log(`[${debugLabel}] Effect triggered #${effectCount.current}`, {
        renderCount: renderCount.current,
        changedDeps,
        allDeps: deps,
      });

      // Detectar possível loop infinito
      if (effectCount.current > 10) {
        console.warn(
          `⚠️ [${debugLabel}] Possível loop infinito detectado! Effect executou ${effectCount.current} vezes.`
        );
      }
    }

    prevDeps.current = deps;
  });

  // Executar o efeito original
  useEffect(effect, deps);
}
