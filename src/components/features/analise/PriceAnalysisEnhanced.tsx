"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import {
  TrendingDown,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Building2,
  Calendar as CalendarIcon,
  Download,
  FileText,
  FileSpreadsheet,
  LineChart,
  Star,
  Filter,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Package,
  Search,
  ArrowUpDown,
  AlertTriangle,
  Minus,
  PieChart,
  Users,
  Clock,
} from "lucide-react";
import { format, subDays, parseISO, startOfDay, endOfDay, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { db } from '@/lib/config/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import type { Supply, Offer, Quotation, Fornecedor } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
} from "recharts";

interface PriceAnalysisItem {
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
}

interface FilterState {
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
}

interface SupplierAnalysis {
  name: string;
  productCount: number;
  averagePrice: number;
  totalOffers: number;
  competitiveness: number;
  categories: string[];
}

export default function PriceAnalysisEnhanced() {
  const [analysisData, setAnalysisData] = useState<PriceAnalysisItem[]>([]);
  const [filteredData, setFilteredData] = useState<PriceAnalysisItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'lastVariationPercent', direction: 'desc' });
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('line');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const { toast } = useToast();

  const [filters, setFilters] = useState<FilterState>({
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
    }
  });

  const loadAnalysisData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Buscar insumos
      const suppliesQuery = query(collection(db, 'supplies'), orderBy('name'));
      const suppliesSnapshot = await getDocs(suppliesQuery);
      const supplies = suppliesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Supply[];

      // Buscar cotações
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

      // Buscar fornecedores
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

      // Extrair categorias únicas dos insumos
      const uniqueCategories = [...new Set(supplies.map(s => s.categoryName).filter(Boolean))];
      setCategories(uniqueCategories);

      // Extrair fornecedores únicos
      const uniqueSuppliers = [...new Set(suppliersData.map(s => s.empresa).filter(Boolean))];
      setSuppliers(uniqueSuppliers);

      // Processar dados de análise para cada insumo
      const analysisItems: PriceAnalysisItem[] = [];

      for (const supply of supplies) {
        const priceHistory: Array<{
          date: string;
          price: number;
          supplier: string;
          quotationId: string;
        }> = [];

        // Buscar ofertas para este insumo em todas as cotações
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

          // Calcular melhor fornecedor (menor preço médio)
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

          // Calcular volatilidade (desvio padrão dos preços)
          const allPrices = priceHistory.map(entry => entry.price);
          const avgPrice = allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length;
          const variance = allPrices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / allPrices.length;
          const volatility = Math.sqrt(variance) / avgPrice * 100;

          // Calcular faixa de preços
          const minPrice = Math.min(...allPrices);
          const maxPrice = Math.max(...allPrices);

          // Determinar nível de competição
          const uniqueSuppliers = new Set(priceHistory.map(entry => entry.supplier)).size;
          let competitionLevel: 'low' | 'medium' | 'high' = 'low';
          if (uniqueSuppliers >= 5) competitionLevel = 'high';
          else if (uniqueSuppliers >= 3) competitionLevel = 'medium';

          // Determinar tendência
          let trend: 'up' | 'down' | 'stable' = 'stable';
          if (Math.abs(lastVariationPercent) > 2) {
            trend = lastVariationPercent > 0 ? 'up' : 'down';
          }

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
            volatility,
            totalOffers: priceHistory.length,
            lastUpdate: priceHistory[0].date,
            trend,
            priceRange: { min: minPrice, max: maxPrice },
            competitionLevel,
            averagePrice: avgPrice
          });
        }
      }

      setAnalysisData(analysisItems);
    } catch (error: any) {
      console.error('Error loading analysis data:', error);
      toast({
        title: "Erro ao carregar análise",
        description: "Não foi possível carregar os dados de análise de preços.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    loadAnalysisData();
  }, [loadAnalysisData]);

  // Aplicar filtros
  useEffect(() => {
    let filtered = [...analysisData];

    // Filtro de busca
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.category?.toLowerCase().includes(searchLower) ||
        item.bestSupplier.toLowerCase().includes(searchLower)
      );
    }

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

    // Filtros de faixa de preço
    if (filters.priceRange.min) {
      const minPrice = parseFloat(filters.priceRange.min);
      filtered = filtered.filter(item => item.currentPrice >= minPrice);
    }
    if (filters.priceRange.max) {
      const maxPrice = parseFloat(filters.priceRange.max);
      filtered = filtered.filter(item => item.currentPrice <= maxPrice);
    }

    // Filtros de volatilidade
    if (filters.volatilityRange.min) {
      const minVolatility = parseFloat(filters.volatilityRange.min);
      filtered = filtered.filter(item => item.volatility >= minVolatility);
    }
    if (filters.volatilityRange.max) {
      const maxVolatility = parseFloat(filters.volatilityRange.max);
      filtered = filtered.filter(item => item.volatility <= maxVolatility);
    }

    // Aplicar ordenação
    filtered.sort((a, b) => {
      const { key, direction } = sortConfig;
      let aValue, bValue;

      switch (key) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'currentPrice':
          aValue = a.currentPrice;
          bValue = b.currentPrice;
          break;
        case 'lastVariationPercent':
          aValue = Math.abs(a.lastVariationPercent);
          bValue = Math.abs(b.lastVariationPercent);
          break;
        case 'volatility':
          aValue = a.volatility;
          bValue = b.volatility;
          break;
        case 'competitionLevel':
          const competitionOrder = { 'low': 1, 'medium': 2, 'high': 3 };
          aValue = competitionOrder[a.competitionLevel];
          bValue = competitionOrder[b.competitionLevel];
          break;
        case 'lastUpdate':
          aValue = new Date(a.lastUpdate).getTime();
          bValue = new Date(b.lastUpdate).getTime();
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredData(filtered);
  }, [analysisData, searchTerm, filters, sortConfig]);

  // Análise de fornecedores
  const supplierAnalysis = useMemo(() => {
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
            categories: []
          });
        }

        const supplierData = analysis.get(entry.supplier)!;
        supplierData.totalOffers++;
        
        // Adicionar categoria se não existir
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
        // Contar produtos únicos por fornecedor
        if (!products.has(entry.supplier)) {
          products.set(entry.supplier, new Set());
        }
        products.get(entry.supplier)!.add(item.id);
        
        // Coletar preços por fornecedor
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
      
      // Calcular competitividade (baseado em número de produtos e ofertas)
      data.competitiveness = (data.productCount * 0.6) + (data.totalOffers * 0.4);
    });

    return Array.from(analysis.values()).sort((a, b) => b.competitiveness - a.competitiveness);
  }, [filteredData]);

  // Dados para gráficos
  const chartData = useMemo(() => {
    if (!selectedProduct) return [];
    
    const product = filteredData.find(item => item.id === selectedProduct);
    if (!product) return [];
    
    return product.priceHistory
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(entry => ({
        date: format(parseISO(entry.date), 'dd/MM'),
        price: entry.price,
        supplier: entry.supplier
      }));
  }, [selectedProduct, filteredData]);

  // Funções auxiliares
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-4 h-4 text-gray-400 inline ml-1" />;
    return sortConfig.direction === 'asc' ? 
      <ChevronUp className="w-4 h-4 inline ml-1" /> : 
      <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const exportToPDF = () => {
    window.print();
  };

  const exportToExcel = () => {
    const csvData = filteredData.map(item => ({
      'Nome': item.name,
      'Categoria': item.category || '',
      'Preço Atual': `R$ ${item.currentPrice.toFixed(2).replace('.', ',')}`,
      'Variação (%)': `${item.lastVariationPercent.toFixed(1)}%`,
      'Melhor Fornecedor': item.bestSupplier,
      'Volatilidade (%)': `${item.volatility.toFixed(1)}%`,
      'Nível de Competição': item.competitionLevel,
      'Total de Ofertas': item.totalOffers,
      'Última Atualização': formatDate(item.lastUpdate)
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `analise-precos-avancada-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Estatísticas
  const stats = useMemo(() => {
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
    const avgPrice = total > 0 ? 
      filteredData.reduce((sum, item) => sum + item.currentPrice, 0) / total : 0;
    const avgVolatility = total > 0 ? 
      filteredData.reduce((sum, item) => sum + item.volatility, 0) / total : 0;

    return { total, withHistory, trending, competition, avgPrice, avgVolatility };
  }, [filteredData]);

  const getCompetitionBadgeVariant = (level: string) => {
    switch (level) {
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const getCompetitionIcon = (level: string) => {
    switch (level) {
      case 'high': return <Users className="w-3 h-3" />;
      case 'medium': return <Users className="w-3 h-3" />;
      case 'low': return <Users className="w-3 h-3" />;
      default: return <Users className="w-3 h-3" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando análise avançada...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            Análise Avançada de Preços
          </h1>
          <p className="text-muted-foreground mt-1">
            Análise inteligente com tendências, competitividade e volatilidade
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAnalysisData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToPDF}>
                <FileText className="h-4 w-4 mr-2" />
                PDF (Imprimir)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Estatísticas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Produtos</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Alta</p>
                <p className="text-2xl font-bold text-red-600">{stats.trending.up}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Baixa</p>
                <p className="text-2xl font-bold text-green-600">{stats.trending.down}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estáveis</p>
                <p className="text-2xl font-bold">{stats.trending.stable}</p>
              </div>
              <Minus className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alta Competição</p>
                <p className="text-2xl font-bold text-green-600">{stats.competition.high}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Volatilidade Média</p>
                <p className="text-2xl font-bold">{stats.avgVolatility.toFixed(1)}%</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros Avançados */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros Avançados
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Switch
                id="advanced-filters"
                checked={showAdvancedFilters}
                onCheckedChange={setShowAdvancedFilters}
              />
              <Label htmlFor="advanced-filters">Filtros Avançados</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Busca */}
            <div>
              <Label>Buscar produtos</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, categoria ou fornecedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Categoria */}
            <div>
              <Label>Categoria</Label>
              <Select 
                value={filters.category} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tendência */}
            <div>
              <Label>Tendência</Label>
              <Select 
                value={filters.trend} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, trend: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="up">Em alta</SelectItem>
                  <SelectItem value="down">Em baixa</SelectItem>
                  <SelectItem value="stable">Estável</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Nível de Competição */}
            <div>
              <Label>Competição</Label>
              <Select 
                value={filters.competitionLevel} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, competitionLevel: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os níveis</SelectItem>
                  <SelectItem value="high">Alta competição</SelectItem>
                  <SelectItem value="medium">Média competição</SelectItem>
                  <SelectItem value="low">Baixa competição</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filtros Avançados */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
              <div>
                <Label>Preço Mínimo</Label>
                <Input
                  type="number"
                  placeholder="R$ 0,00"
                  value={filters.priceRange.min}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    priceRange: { ...prev.priceRange, min: e.target.value }
                  }))}
                />
              </div>

              <div>
                <Label>Preço Máximo</Label>
                <Input
                  type="number"
                  placeholder="R$ 999,99"
                  value={filters.priceRange.max}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    priceRange: { ...prev.priceRange, max: e.target.value }
                  }))}
                />
              </div>

              <div>
                <Label>Volatilidade Mínima (%)</Label>
                <Input
                  type="number"
                  placeholder="0%"
                  value={filters.volatilityRange.min}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    volatilityRange: { ...prev.volatilityRange, min: e.target.value }
                  }))}
                />
              </div>

              <div>
                <Label>Volatilidade Máxima (%)</Label>
                <Input
                  type="number"
                  placeholder="100%"
                  value={filters.volatilityRange.max}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    volatilityRange: { ...prev.volatilityRange, max: e.target.value }
                  }))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visualização com Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="products">Produtos ({filteredData.length})</TabsTrigger>
          <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
          <TabsTrigger value="charts">Gráficos</TabsTrigger>
          <TabsTrigger value="analysis">Análise Detalhada</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredData.slice(0, 8).map(item => {
              const isExpanded = expandedItems.has(item.id);
              const visibleHistory = isExpanded ? item.priceHistory : item.priceHistory.slice(0, 2);

              return (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{item.name}</h3>
                        <p className="text-sm text-muted-foreground">{item.category || 'Sem categoria'}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Badge 
                          variant={
                            item.trend === 'up' ? 'destructive' : 
                            item.trend === 'down' ? 'default' : 'secondary'
                          }
                        >
                          {item.trend === 'up' && <TrendingUp className="h-3 w-3 mr-1" />}
                          {item.trend === 'down' && <TrendingDown className="h-3 w-3 mr-1" />}
                          {item.trend === 'stable' && <Minus className="h-3 w-3 mr-1" />}
                          {item.lastVariationPercent >= 0 ? '+' : ''}{item.lastVariationPercent.toFixed(1)}%
                        </Badge>
                        <Badge variant={getCompetitionBadgeVariant(item.competitionLevel)}>
                          {getCompetitionIcon(item.competitionLevel)}
                          <span className="ml-1 capitalize">{item.competitionLevel}</span>
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Atual</p>
                        <p className="font-semibold text-green-600">{formatCurrency(item.currentPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Volatilidade</p>
                        <p className="font-semibold">{item.volatility.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Ofertas</p>
                        <p className="font-semibold">{item.totalOffers}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Melhor Fornecedor</p>
                        <p className="text-sm font-medium text-blue-600">{item.bestSupplier}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(item.bestSupplierPrice)}</p>
                      </div>

                      {item.priceHistory.length > 0 && (
                        <div className="border-t pt-2">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">
                              Histórico Recente
                            </p>
                            {item.priceHistory.length > 2 && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => toggleExpanded(item.id)}
                                className="text-xs h-6 px-2"
                              >
                                {isExpanded ? (
                                  <><EyeOff className="w-3 h-3 mr-1" />Menos</>
                                ) : (
                                  <><Eye className="w-3 h-3 mr-1" />Mais</>
                                )}
                              </Button>
                            )}
                          </div>
                          <div className="space-y-1">
                            {visibleHistory.map((entry, index) => (
                              <div key={index} className="flex items-center justify-between text-xs py-1 px-2 bg-muted/20 rounded">
                                <div className="flex-1">
                                  <p className="font-medium">{formatDate(entry.date)}</p>
                                  <p className="text-muted-foreground text-xs truncate">{entry.supplier}</p>
                                </div>
                                <p className="font-semibold text-green-600">{formatCurrency(entry.price)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista Completa de Produtos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer" 
                        onClick={() => handleSort('name')}
                      >
                        Nome {getSortIcon('name')}
                      </TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead 
                        className="cursor-pointer text-right" 
                        onClick={() => handleSort('currentPrice')}
                      >
                        Preço Atual {getSortIcon('currentPrice')}
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer text-right" 
                        onClick={() => handleSort('lastVariationPercent')}
                      >
                        Variação {getSortIcon('lastVariationPercent')}
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer text-right" 
                        onClick={() => handleSort('volatility')}
                      >
                        Volatilidade {getSortIcon('volatility')}
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer" 
                        onClick={() => handleSort('competitionLevel')}
                      >
                        Competição {getSortIcon('competitionLevel')}
                      </TableHead>
                      <TableHead>Melhor Fornecedor</TableHead>
                      <TableHead className="text-right">Ofertas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.category || 'N/A'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.currentPrice)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {item.trend === 'up' && <TrendingUp className="w-4 h-4 text-red-500" />}
                            {item.trend === 'down' && <TrendingDown className="w-4 h-4 text-green-500" />}
                            {item.trend === 'stable' && <Minus className="w-4 h-4 text-gray-500" />}
                            <span className={
                              item.lastVariationPercent > 0 ? "text-red-600" :
                              item.lastVariationPercent < 0 ? "text-green-600" : "text-gray-600"
                            }>
                              {item.lastVariationPercent >= 0 ? '+' : ''}{item.lastVariationPercent.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.volatility.toFixed(1)}%</TableCell>
                        <TableCell>
                          <Badge variant={getCompetitionBadgeVariant(item.competitionLevel)}>
                            {getCompetitionIcon(item.competitionLevel)}
                            <span className="ml-1 capitalize">{item.competitionLevel}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.bestSupplier}</p>
                            <p className="text-sm text-muted-foreground">{formatCurrency(item.bestSupplierPrice)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.totalOffers}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise de Fornecedores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="text-right">Produtos</TableHead>
                      <TableHead className="text-right">Preço Médio</TableHead>
                      <TableHead className="text-right">Total de Ofertas</TableHead>
                      <TableHead className="text-right">Competitividade</TableHead>
                      <TableHead>Categorias</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierAnalysis.map((supplier, index) => (
                      <TableRow key={supplier.name}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </div>
                            {supplier.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{supplier.productCount}</TableCell>
                        <TableCell className="text-right">{formatCurrency(supplier.averagePrice)}</TableCell>
                        <TableCell className="text-right">{supplier.totalOffers}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end">
                            <div className="w-20 bg-muted h-2 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${Math.min(100, (supplier.competitiveness / Math.max(...supplierAnalysis.map(s => s.competitiveness))) * 100)}%` }}
                              ></div>
                            </div>
                            <span className="ml-2 text-sm">{supplier.competitiveness.toFixed(1)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {supplier.categories.slice(0, 3).map(category => (
                              <Badge key={category} variant="outline" className="text-xs">
                                {category}
                              </Badge>
                            ))}
                            {supplier.categories.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{supplier.categories.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5" />
                  Evolução de Preços
                </CardTitle>
                <div className="flex gap-3 items-center">
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredData
                        .filter(item => item.priceHistory.length > 1)
                        .map(item => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} ({item.priceHistory.length} ofertas)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Select value={chartType} onValueChange={(value: 'line' | 'area' | 'bar') => setChartType(value)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">Linha</SelectItem>
                      <SelectItem value="area">Área</SelectItem>
                      <SelectItem value="bar">Barras</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <>
                      {chartType === 'line' && (
                      <RechartsLineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip 
                          formatter={(value) => [formatCurrency(value as number), 'Preço']}
                          labelFormatter={(label) => `Data: ${label}`}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="price" 
                          stroke="#2563eb" 
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </RechartsLineChart>
                    )}
                    {chartType === 'area' && (
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip 
                          formatter={(value) => [formatCurrency(value as number), 'Preço']}
                          labelFormatter={(label) => `Data: ${label}`}
                        />
                        <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="price" 
                          stroke="#2563eb" 
                          fill="#2563eb" 
                          fillOpacity={0.3}
                        />
                      </AreaChart>
                    )}
                    {chartType === 'bar' && (
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip 
                          formatter={(value) => [formatCurrency(value as number), 'Preço']}
                          labelFormatter={(label) => `Data: ${label}`}
                        />
                        <Legend />
                        <Bar dataKey="price" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    )}
                    </>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px]">
                  <PieChart className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Selecione um produto para visualizar o gráfico</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Top produtos mais voláteis */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Mais Voláteis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredData
                    .filter(item => item.volatility > 0)
                    .sort((a, b) => b.volatility - a.volatility)
                    .slice(0, 5)
                    .map((item, index) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium truncate">{item.name}</span>
                        </div>
                        <span className="text-sm font-bold text-red-600">{item.volatility.toFixed(1)}%</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Top produtos mais caros */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Mais Caros</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredData
                    .sort((a, b) => b.currentPrice - a.currentPrice)
                    .slice(0, 5)
                    .map((item, index) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium truncate">{item.name}</span>
                        </div>
                        <span className="text-sm font-bold text-blue-600">{formatCurrency(item.currentPrice)}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Produtos com alta competição */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Alta Competição</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredData
                    .filter(item => item.competitionLevel === 'high')
                    .sort((a, b) => b.totalOffers - a.totalOffers)
                    .slice(0, 5)
                    .map((item, index) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium truncate">{item.name}</span>
                        </div>
                        <span className="text-sm font-bold text-green-600">{item.totalOffers} ofertas</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Produtos com baixa competição */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Baixa Competição</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredData
                    .filter(item => item.competitionLevel === 'low')
                    .sort((a, b) => a.totalOffers - b.totalOffers)
                    .slice(0, 5)
                    .map((item, index) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-yellow-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium truncate">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-yellow-600" />
                          <span className="text-sm font-bold text-yellow-600">{item.totalOffers} oferta{item.totalOffers !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alertas e Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Alertas e Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Produtos sem competição */}
                {stats.competition.low > 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <h4 className="font-semibold text-yellow-800">Baixa Competição</h4>
                    </div>
                    <p className="text-sm text-yellow-700">
                      {stats.competition.low} produtos com poucas ofertas. 
                      Considere buscar mais fornecedores.
                    </p>
                  </div>
                )}

                {/* Produtos com alta volatilidade */}
                {filteredData.filter(item => item.volatility > 20).length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-red-600" />
                      <h4 className="font-semibold text-red-800">Alta Volatilidade</h4>
                    </div>
                    <p className="text-sm text-red-700">
                      {filteredData.filter(item => item.volatility > 20).length} produtos 
                      com volatilidade acima de 20%. Monitoramento recomendado.
                    </p>
                  </div>
                )}

                {/* Produtos com tendência de alta */}
                {stats.trending.up > 0 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <h4 className="font-semibold text-blue-800">Tendência de Alta</h4>
                    </div>
                    <p className="text-sm text-blue-700">
                      {stats.trending.up} produtos em tendência de alta. 
                      Considere antecipar compras.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}