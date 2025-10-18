/**
 * useSupplySelection Hook
 *
 * Gerencia filtros de seleção de insumos (busca e categoria).
 * Implementa lógica de filtro com busca por nome e marcas.
 */

import { useState, useMemo } from 'react';
import type { Supply, SupplyCategory } from '@/types';

interface UseSupplySelectionResult {
  filteredSupplies: Supply[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  clearFilters: () => void;
}

/**
 * Hook para gerenciar filtros de seleção de insumos
 *
 * @param allSupplies - Lista completa de insumos
 * @param categories - Lista de categorias disponíveis
 * @returns Estado de filtros e insumos filtrados
 */
export function useSupplySelection(
  allSupplies: Supply[],
  categories: SupplyCategory[]
): UseSupplySelectionResult {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState('');

  // Filtro reativo com useMemo para performance
  const filteredSupplies = useMemo(() => {
    let suppliesToFilter = [...allSupplies];

    // Filtro por categoria
    if (activeTab !== "all") {
      suppliesToFilter = suppliesToFilter.filter(
        supply => supply.categoryId === activeTab
      );
    }

    // Filtro por busca (nome ou marcas)
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      suppliesToFilter = suppliesToFilter.filter(supply => {
        // Busca no nome
        const nameMatch = supply.name.toLowerCase().includes(lowercasedFilter);

        // Busca nas marcas preferenciais
        let brandsMatch = false;
        if (supply.preferredBrands) {
          const brandsStr = Array.isArray(supply.preferredBrands)
            ? supply.preferredBrands.join(',')
            : String(supply.preferredBrands);
          brandsMatch = brandsStr.toLowerCase().includes(lowercasedFilter);
        }

        return nameMatch || brandsMatch;
      });
    }

    return suppliesToFilter;
  }, [activeTab, allSupplies, searchTerm]);

  const clearFilters = () => {
    setActiveTab("all");
    setSearchTerm('');
  };

  return {
    filteredSupplies,
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    clearFilters,
  };
}
