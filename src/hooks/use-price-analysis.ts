import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '@/lib/config/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import { subDays, parseISO, format } from 'date-fns';
import type { Supply, Offer, Quotation, Fornecedor } from '@/types';

export interface PriceAnalysisItem {
  id: string;
  name: string;
  category?: string;
  unit: string;
  currentPrice: number;
  previousPrice?: number;
  priceHistory: Array<{
    date: string;
    price: number;
    supplier: string;
    quotationId: string;
  }>;
  lastVariation: number;
  lastVariationPercent: number;
  bestSupplier: string;
  bestSupplierPrice: number;
  volatility: number;
  totalOffers: number;
  lastUpdate: string;
  trend: 'up' | 'down' | 'stable';
  priceRange: {
    min: number;
    max: number;
  };
  competitionLevel: 'low' | 'medium' | 'high';
  averagePrice: number;
  marketPosition: 'cheap' | 'average' | 'expensive';
  priceStability: 'very_stable' | 'stable' | 'moderate' | 'volatile' | 'very_volatile';
}

export interface AnalysisFilters {
  dateRange: {
    start: Date;
    end: Date;
  };
  category: string;
  supplier: string;
  priceRange: {
    min: string;
    max: string;
  };
  trend: string;
  competitionLevel: string;
  volatilityRange: {
    min: string;
    max: string;
  };
  marketPosition: string;
}

export interface AnalysisStats {
  total: number;
  withHistory: number;
  trending: {
    up: number;
    down: number;
    stable: number;
  };
  competition: {
    low: number;
    medium: number;
    high: number;
  };
  marketPosition: {
    cheap: number;
    average: number;
    expensive: number;
  };
  avgPrice: number;
  avgVolatility: number;
  totalValue: number;
  potentialSavings: number;
}

export interface SupplierAnalysis {
  name: string;
  productCount: number;
  averagePrice: number;
  totalOffers: number;
  competitiveness: number;
  categories: string[];
  reliability: number;
  priceConsistency: number;
}

export function usePriceAnalysis() {
  const [analysisData, setAnalysisData] = useState<PriceAnalysisItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<AnalysisFilters>({
    dateRange: {
      start: subDays(new Date(), 90),
      end: new Date()
    },
    category: "all",
    supplier: "all",
    priceRange: {
      min: "",
      max: ""
    },
    trend: "all",
    competitionLevel: "all",
    volatilityRange: {
      min: "",
      max: ""
    },
    marketPosition: "all"
  });

  // Função para calcular posição de mercado
  const calculateMarketPosition = useCallback((price: number, allPrices: number[]): 'cheap' | 'average' | 'expensive' => {
    if (allPrices.length === 0) return 'average';
    
    const sortedPrices = [...allPrices].sort((a, b) => a - b);
    const percentile33 = sortedPrices[Math.floor(sortedPrices.length * 0.33)];
    const percentile66 = sortedPrices[Math.floor(sortedPrices.length * 0.66)];
    
    if (price <= percentile33) return 'cheap';
    if (price >= percentile66) return 'expensive';
    return 'average';
  }, []);

  // Função para calcular estabilidade de preços
  const calculatePriceStability = useCallback((volatility: number): 'very_stable' | 'stable' | 'moderate' | 'volatile' | 'very_volatile' => {
    if (volatility < 5) return 'very_stable';
    if (volatility < 10) return 'stable';
    if (volatility < 20) return 'moderate';
    if (volatility < 35) return 'volatile';
    return 'very_volatile';
  }, []);

  // Carregar dados de análise
  const loadAnalysisData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Buscar insumos
      const suppliesQuery = query(collection(db, 'supplies'), orderBy('name'));
      const suppliesSnapshot = await getDocs(suppliesQuery);
      const supplies = suppliesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Supply[];

      // Buscar cotações no período
      const quotationsQuery = query(
        collection(db, 'quotations'),
        where('createdAt', '>=', Timestamp.fromDate(filters.dateRange.start)),
        where('createdAt', '<=', Timestamp.fromDate(filters.dateRange.end)),
        orderBy('createdAt', 'desc')
      );
      const quotationsSnapshot = await getDocs(quotationsQuery);
      const quotations = quotationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quotation[];

      // Buscar fornecedores ativos
      const suppliersQuery = query(
        collection(db, 'fornecedores'),
        where('status', '==', 'ativo'),
        orderBy('empresa')
      );
      const suppliersSnapshot = await getDocs(suppliersQuery);
      const suppliersData = suppliersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Fornecedor[];

      // Extrair categorias e fornecedores únicos
      const uniqueCategories = [...new Set(supplies.map(s => s.categoryName).filter(Boolean))];
      setCategories(uniqueCategories);

      const uniqueSuppliers = [...new Set(suppliersData.map(s => s.empresa).filter(Boolean))];
      setSuppliers(uniqueSuppliers);

      // Processar dados de análise
      const analysisItems: PriceAnalysisItem[] = [];
      const allCurrentPrices: number[] = [];

      // Primeira passagem: coletar todos os preços atuais para cálculo de posição de mercado
      for (const supply of supplies) {
        const priceHistory: Array<{
          date: string;
          price: number;
          supplier: string;
          quotationId: string;
        }> = [];

        for (const quotation of quotations) {
          try {
            const offersPath = `quotations/${quotation.id}/products/${supply.id}/offers`;
            const offersQuery = query(collection(db, offersPath));
            const offersSnapshot = await getDocs(offersQuery);
            
            offersSnapshot.docs.forEach(offerDoc => {
              const offer = { id: offerDoc.id, ...offerDoc.data() } as Offer;
              if (offer.pricePerUnit && offer.supplierName) {
                priceHistory.push({
                  date: offer.updatedAt ? (offer.updatedAt as any).toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                  price: offer.pricePerUnit,
                  supplier: offer.supplierName,
                  quotationId: quotation.id
                });
              }
            });
          } catch (error) {
            // Ignorar erros para insumos sem ofertas nesta cotação
          }
        }

        if (priceHistory.length > 0) {
          priceHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          allCurrentPrices.push(priceHistory[0].price);
        }
      }

      // Segunda passagem: processar análise completa
      for (const supply of supplies) {
        const priceHistory: Array<{
          date: string;
          price: number;
          supplier: string;
          quotationId: string;
        }> = [];

        for (const quotation of quotations) {
          try {
            const offersPath = `quotations/${quotation.id}/products/${supply.id}/offers`;
            const offersQuery = query(collection(db, offersPath));
            const offersSnapshot = await getDocs(offersQuery);
            
            offersSnapshot.docs.forEach(offerDoc => {
              const offer = { id: offerDoc.id, ...offerDoc.data() } as Offer;
              if (offer.pricePerUnit && offer.supplierName) {
                priceHistory.push({
                  date: offer.updatedAt ? (offer.updatedAt as any).toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                  price: offer.pricePerUnit,
                  supplier: offer.supplierName,
                  quotationId: quotation.id
                });
              }
            });
          } catch (error) {
            // Ignorar erros para insumos sem ofertas nesta cotação
          }
        }

        if (priceHistory.length > 0) {
          // Ordenar histórico por data
          priceHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          const currentPrice = priceHistory[0].price;
          const previousPrice = priceHistory.length > 1 ? priceHistory[1].price : undefined;
          
          const lastVariation = previousPrice ? currentPrice - previousPrice : 0;
          const lastVariationPercent = previousPrice ? (lastVariation / previousPrice) * 100 : 0;

          // Análise de fornecedores
          const supplierPrices = new Map<string, number[]>();
          priceHistory.forEach(entry => {
            const prices = supplierPrices.get(entry.supplier) || [];
            prices.push(entry.price);
            supplierPrices.set(entry.supplier, prices);
          });

          let bestSupplier = "";
          let bestSupplierPrice = Infinity;
          
          supplierPrices.forEach((prices, supplier) => {
            const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
            if (avgPrice < bestSupplierPrice) {
              bestSupplierPrice = avgPrice;
              bestSupplier = supplier;
            }
          });

          // Cálculos estatísticos
          const allPrices = priceHistory.map(entry => entry.price);
          const avgPrice = allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length;
          const variance = allPrices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / allPrices.length;
          const volatility = Math.sqrt(variance) / avgPrice * 100;

          const minPrice = Math.min(...allPrices);
          const maxPrice = Math.max(...allPrices);

          // Nível de competição baseado no número de fornecedores únicos
          const uniqueSuppliers = new Set(priceHistory.map(entry => entry.supplier)).size;
          let competitionLevel: 'low' | 'medium' | 'high' = 'low';
          if (uniqueSuppliers >= 5) competitionLevel = 'high';
          else if (uniqueSuppliers >= 3) competitionLevel = 'medium';

          // Tendência
          let trend: 'up' | 'down' | 'stable' = 'stable';
          if (Math.abs(lastVariationPercent) > 2) {
            trend = lastVariationPercent > 0 ? 'up' : 'down';
          }

          // Posição de mercado e estabilidade
          const marketPosition = calculateMarketPosition(currentPrice, allCurrentPrices);
          const priceStability = calculatePriceStability(volatility);

          analysisItems.push({
            id: supply.id,
            name: supply.name,
            category: supply.categoryName,
            unit: supply.unit,
            currentPrice,
            previousPrice,
            priceHistory,
            lastVariation,
            lastVariationPercent,
            bestSupplier,
            bestSupplierPrice,
            volatility: isNaN(volatility) ? 0 : volatility,
            totalOffers: priceHistory.length,
            lastUpdate: priceHistory[0].date,
            trend,
            priceRange: { min: minPrice, max: maxPrice },
            competitionLevel,
            averagePrice: avgPrice,
            marketPosition,
            priceStability
          });
        }
      }

      setAnalysisData(analysisItems);
    } catch (error: any) {
      console.error('Error loading analysis data:', error);
      setError('Não foi possível carregar os dados de análise de preços.');
    } finally {
      setLoading(false);
    }
  }, [filters.dateRange, calculateMarketPosition, calculatePriceStability]);

  // Aplicar filtros aos dados
  const filteredData = useMemo(() => {
    let filtered = [...analysisData];

    // Filtros básicos
    if (filters.category !== "all") {
      filtered = filtered.filter(item => item.category === filters.category);
    }

    if (filters.supplier !== "all") {
      filtered = filtered.filter(item => item.bestSupplier === filters.supplier);
    }

    if (filters.trend !== "all") {
      filtered = filtered.filter(item => item.trend === filters.trend);
    }

    if (filters.competitionLevel !== "all") {
      filtered = filtered.filter(item => item.competitionLevel === filters.competitionLevel);
    }

    if (filters.marketPosition !== "all") {
      filtered = filtered.filter(item => item.marketPosition === filters.marketPosition);
    }

    // Filtros de faixa
    if (filters.priceRange.min) {
      const minPrice = parseFloat(filters.priceRange.min);
      filtered = filtered.filter(item => item.currentPrice >= minPrice);
    }
    if (filters.priceRange.max) {
      const maxPrice = parseFloat(filters.priceRange.max);
      filtered = filtered.filter(item => item.currentPrice <= maxPrice);
    }

    if (filters.volatilityRange.min) {
      const minVolatility = parseFloat(filters.volatilityRange.min);
      filtered = filtered.filter(item => item.volatility >= minVolatility);
    }
    if (filters.volatilityRange.max) {
      const maxVolatility = parseFloat(filters.volatilityRange.max);
      filtered = filtered.filter(item => item.volatility <= maxVolatility);
    }

    return filtered;
  }, [analysisData, filters]);

  // Estatísticas calculadas
  const stats = useMemo((): AnalysisStats => {
    const total = filteredData.length;
    const withHistory = filteredData.filter(item => item.totalOffers > 1).length;
    
    const trending = {
      up: filteredData.filter(item => item.trend === 'up').length,
      down: filteredData.filter(item => item.trend === 'down').length,
      stable: filteredData.filter(item => item.trend === 'stable').length
    };
    
    const competition = {
      low: filteredData.filter(item => item.competitionLevel === 'low').length,
      medium: filteredData.filter(item => item.competitionLevel === 'medium').length,
      high: filteredData.filter(item => item.competitionLevel === 'high').length
    };
    
    const marketPosition = {
      cheap: filteredData.filter(item => item.marketPosition === 'cheap').length,
      average: filteredData.filter(item => item.marketPosition === 'average').length,
      expensive: filteredData.filter(item => item.marketPosition === 'expensive').length
    };
    
    const avgPrice = total > 0 ? 
      filteredData.reduce((sum, item) => sum + item.currentPrice, 0) / total : 0;
    
    const avgVolatility = total > 0 ? 
      filteredData.reduce((sum, item) => sum + item.volatility, 0) / total : 0;

    const totalValue = filteredData.reduce((sum, item) => sum + item.currentPrice, 0);
    
    // Cálculo de economia potencial (comparando com preço médio do melhor fornecedor)
    const potentialSavings = filteredData.reduce((sum, item) => {
      const saving = Math.max(0, item.currentPrice - item.bestSupplierPrice);
      return sum + saving;
    }, 0);

    return {
      total,
      withHistory,
      trending,
      competition,
      marketPosition,
      avgPrice,
      avgVolatility,
      totalValue,
      potentialSavings
    };
  }, [filteredData]);

  // Análise de fornecedores
  const supplierAnalysis = useMemo((): SupplierAnalysis[] => {
    const analysis = new Map<string, SupplierAnalysis>();
    
    filteredData.forEach(item => {
      item.priceHistory.forEach(entry => {
        if (!analysis.has(entry.supplier)) {
          analysis.set(entry.supplier, {
            name: entry.supplier,
            productCount: 0,
            averagePrice: 0,
            totalOffers: 0,
            competitiveness: 0,
            categories: [],
            reliability: 0,
            priceConsistency: 0
          });
        }

        const supplierData = analysis.get(entry.supplier)!;
        supplierData.totalOffers++;
        
        if (item.category && !supplierData.categories.includes(item.category)) {
          supplierData.categories.push(item.category);
        }
      });
    });

    // Calcular estatísticas finais
    const products = new Map<string, Set<string>>();
    const prices = new Map<string, number[]>();
    
    filteredData.forEach(item => {
      item.priceHistory.forEach(entry => {
        if (!products.has(entry.supplier)) {
          products.set(entry.supplier, new Set());
        }
        products.get(entry.supplier)!.add(item.id);
        
        if (!prices.has(entry.supplier)) {
          prices.set(entry.supplier, []);
        }
        prices.get(entry.supplier)!.push(entry.price);
      });
    });

    analysis.forEach((data, supplier) => {
      const supplierProducts = products.get(supplier);
      const supplierPrices = prices.get(supplier);
      
      data.productCount = supplierProducts ? supplierProducts.size : 0;
      data.averagePrice = supplierPrices && supplierPrices.length > 0 
        ? supplierPrices.reduce((sum, price) => sum + price, 0) / supplierPrices.length 
        : 0;
      
      // Calcular competitividade
      data.competitiveness = (data.productCount * 0.6) + (data.totalOffers * 0.4);
      
      // Calcular confiabilidade (baseado na consistência de participação)
      data.reliability = Math.min(100, (data.totalOffers / Math.max(1, data.productCount)) * 20);
      
      // Calcular consistência de preços (inverso da volatilidade)
      if (supplierPrices && supplierPrices.length > 1) {
        const avg = data.averagePrice;
        const variance = supplierPrices.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) / supplierPrices.length;
        const volatility = Math.sqrt(variance) / avg * 100;
        data.priceConsistency = Math.max(0, 100 - volatility);
      } else {
        data.priceConsistency = 50;
      }
    });

    return Array.from(analysis.values()).sort((a, b) => b.competitiveness - a.competitiveness);
  }, [filteredData]);

  // Função para buscar por texto
  const searchData = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return filteredData;
    
    const searchLower = searchTerm.toLowerCase();
    return filteredData.filter(item =>
      item.name.toLowerCase().includes(searchLower) ||
      item.category?.toLowerCase().includes(searchLower) ||
      item.bestSupplier.toLowerCase().includes(searchLower)
    );
  }, [filteredData]);

  // Função para exportar dados
  const exportData = useCallback((format: 'csv' | 'json' = 'csv') => {
    if (format === 'csv') {
      const csvData = filteredData.map(item => ({
        'Nome': item.name,
        'Categoria': item.category || '',
        'Preço Atual': `R$ ${item.currentPrice.toFixed(2).replace('.', ',')}`,
        'Variação (%)': `${item.lastVariationPercent.toFixed(1)}%`,
        'Melhor Fornecedor': item.bestSupplier,
        'Volatilidade (%)': `${item.volatility.toFixed(1)}%`,
        'Nível de Competição': item.competitionLevel,
        'Posição de Mercado': item.marketPosition,
        'Total de Ofertas': item.totalOffers,
        'Última Atualização': item.lastUpdate
      }));

      const csvContent = [
        Object.keys(csvData[0]).join(','),
        ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
      ].join('\n');

      return csvContent;
    } else {
      return JSON.stringify(filteredData, null, 2);
    }
  }, [filteredData]);

  return {
    // Dados
    analysisData,
    filteredData,
    categories,
    suppliers,
    stats,
    supplierAnalysis,
    
    // Estados
    loading,
    error,
    filters,
    
    // Ações
    setFilters,
    loadAnalysisData,
    searchData,
    exportData,
    
    // Funções auxiliares
    calculateMarketPosition,
    calculatePriceStability
  };
}