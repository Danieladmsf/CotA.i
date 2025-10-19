"use client";

import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  TrendingDown,
  TrendingUp,
  Calendar as CalendarIcon,
  Download,
  RefreshCw,
  Loader2,
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Package,
  Clock,
} from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { db } from '@/lib/config/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import type { PriceHistory, Supply } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSetHeaderActions } from '@/contexts/HeaderActionsContext';

interface PriceHistoryDisplay extends PriceHistory {
  supplyName: string;
}

export default function PriceHistoryTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const setActions = useSetHeaderActions();
  const previousActionsRef = useRef<React.ReactNode>(null);

  const [historyData, setHistoryData] = useState<PriceHistoryDisplay[]>([]);
  const [filteredData, setFilteredData] = useState<PriceHistoryDisplay[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 90),
    to: new Date()
  });

  const [filters, setFilters] = useState({
    category: "all",
    supplier: "all",
    trend: "all"
  });

  // Load price history data
  const loadHistoryData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch supplies to get supply names
      const suppliesQuery = query(
        collection(db, 'supplies'),
        where('userId', '==', user.uid),
        orderBy('name')
      );
      const suppliesSnapshot = await getDocs(suppliesQuery);
      const supplies = suppliesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Supply[];

      const suppliesMap = new Map<string, Supply>();
      supplies.forEach(supply => {
        suppliesMap.set(supply.id, supply);
      });

      // Extract unique categories
      const uniqueCategories = [...new Set(supplies.map(s => s.categoryName).filter(Boolean))];
      setCategories(uniqueCategories);

      // Fetch price history
      const historyQuery = query(
        collection(db, 'price_history'),
        where('userId', '==', user.uid),
        where('createdAt', '>=', Timestamp.fromDate(dateRange?.from || subDays(new Date(), 90))),
        where('createdAt', '<=', Timestamp.fromDate(dateRange?.to || new Date())),
        orderBy('createdAt', 'desc')
      );

      const historySnapshot = await getDocs(historyQuery);
      const historyItems: PriceHistoryDisplay[] = historySnapshot.docs.map(doc => {
        const data = { id: doc.id, ...doc.data() } as PriceHistory;
        const supply = suppliesMap.get(data.supplyId);

        return {
          ...data,
          supplyName: supply?.name || data.supplyName || 'Desconhecido'
        };
      });

      // Extract unique suppliers
      const uniqueSuppliers = [...new Set(historyItems.map(h => h.supplier).filter(Boolean))];
      setSuppliers(uniqueSuppliers);

      setHistoryData(historyItems);
    } catch (error: any) {
      console.error('Error loading price history:', error);
      toast({
        title: "Erro ao carregar histórico",
        description: "Não foi possível carregar o histórico de preços.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistoryData();
  }, [user, dateRange]);

  // Apply filters
  useEffect(() => {
    let filtered = [...historyData];

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.supplyName.toLowerCase().includes(searchLower) ||
        item.supplier.toLowerCase().includes(searchLower) ||
        item.category.toLowerCase().includes(searchLower)
      );
    }

    // Category filter
    if (filters.category !== "all") {
      filtered = filtered.filter(item => item.category === filters.category);
    }

    // Supplier filter
    if (filters.supplier !== "all") {
      filtered = filtered.filter(item => item.supplier === filters.supplier);
    }

    // Trend filter
    if (filters.trend !== "all") {
      if (filters.trend === "up") {
        filtered = filtered.filter(item => item.percentage_change > 0);
      } else if (filters.trend === "down") {
        filtered = filtered.filter(item => item.percentage_change < 0);
      } else if (filters.trend === "stable") {
        filtered = filtered.filter(item => item.percentage_change === 0);
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const { key, direction } = sortConfig;
      let aValue: any, bValue: any;

      switch (key) {
        case 'supplyName':
          aValue = a.supplyName;
          bValue = b.supplyName;
          break;
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'new_price':
          aValue = a.new_price;
          bValue = b.new_price;
          break;
        case 'percentage_change':
          aValue = Math.abs(a.percentage_change);
          bValue = Math.abs(b.percentage_change);
          break;
        case 'supplier':
          aValue = a.supplier;
          bValue = b.supplier;
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
  }, [historyData, searchTerm, filters, sortConfig]);

  // Statistics
  const stats = useMemo(() => {
    const total = filteredData.length;
    const increases = filteredData.filter(item => item.percentage_change > 0).length;
    const decreases = filteredData.filter(item => item.percentage_change < 0).length;
    const stable = filteredData.filter(item => item.percentage_change === 0).length;

    const avgChange = total > 0
      ? filteredData.reduce((sum, item) => sum + item.percentage_change, 0) / total
      : 0;

    const totalValueChange = filteredData.reduce((sum, item) => {
      return sum + (item.new_price - (item.old_price || 0));
    }, 0);

    return {
      total,
      increases,
      decreases,
      stable,
      avgChange,
      totalValueChange
    };
  }, [filteredData]);

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

  const exportToCSV = useCallback(() => {
    const csvData = filteredData.map(item => ({
      'Insumo': item.supplyName,
      'Categoria': item.category,
      'Data': formatDate(item.date),
      'Preço Anterior': item.old_price ? `R$ ${item.old_price.toFixed(2).replace('.', ',')}` : '-',
      'Preço Novo': `R$ ${item.new_price.toFixed(2).replace('.', ',')}`,
      'Variação (%)': `${item.percentage_change.toFixed(1)}%`,
      'Fornecedor': item.supplier
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `historico-precos-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredData]);

  // Memoizar ações do header
  const headerActions = useMemo(() => (
    <>
      <Button variant="outline" onClick={loadHistoryData}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Atualizar
      </Button>
      <Button variant="outline" onClick={exportToCSV} disabled={filteredData.length === 0}>
        <Download className="h-4 w-4 mr-2" />
        Exportar CSV
      </Button>
    </>
  ), [loadHistoryData, exportToCSV, filteredData.length]);

  // Definir ações do header usando useLayoutEffect para executar antes do paint
  useLayoutEffect(() => {
    if (headerActions !== previousActionsRef.current) {
      previousActionsRef.current = headerActions;
      setActions(headerActions);
    }
    return () => setActions(null);
  }, [headerActions, setActions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando histórico de preços...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range and Export */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from && dateRange?.to ?
                      `${format(dateRange.from, "dd/MM/yy")} - ${format(dateRange.to, "dd/MM/yy")}` :
                      "Selecionar período"
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="range" selected={dateRange} onSelect={setDateRange} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Registros</p>
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
                <p className="text-sm text-muted-foreground">Aumentos</p>
                <p className="text-2xl font-bold text-red-600">{stats.increases}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reduções</p>
                <p className="text-2xl font-bold text-green-600">{stats.decreases}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Variação Média</p>
                <p className={`text-2xl font-bold ${stats.avgChange > 0 ? 'text-red-600' : stats.avgChange < 0 ? 'text-green-600' : ''}`}>
                  {stats.avgChange >= 0 ? '+' : ''}{stats.avgChange.toFixed(1)}%
                </p>
              </div>
              <Clock className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-muted-foreground">Impacto Total</p>
              <p className={`text-2xl font-bold ${stats.totalValueChange > 0 ? 'text-red-600' : stats.totalValueChange < 0 ? 'text-green-600' : ''}`}>
                {formatCurrency(Math.abs(stats.totalValueChange))}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.totalValueChange > 0 ? 'Aumento' : stats.totalValueChange < 0 ? 'Economia' : 'Neutro'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Insumo, fornecedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <Label>Categoria</Label>
              <Select
                value={filters.category}
                onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Supplier */}
            <div>
              <Label>Fornecedor</Label>
              <Select
                value={filters.supplier}
                onValueChange={(value) => setFilters(prev => ({ ...prev, supplier: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os fornecedores</SelectItem>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Trend */}
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
                  <SelectItem value="up">Aumentou</SelectItem>
                  <SelectItem value="down">Diminuiu</SelectItem>
                  <SelectItem value="stable">Estável</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Alterações ({filteredData.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('supplyName')}
                  >
                    Insumo {getSortIcon('supplyName')}
                  </TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead
                    className="cursor-pointer text-right"
                    onClick={() => handleSort('date')}
                  >
                    Data {getSortIcon('date')}
                  </TableHead>
                  <TableHead className="text-right">Preço Anterior</TableHead>
                  <TableHead
                    className="cursor-pointer text-right"
                    onClick={() => handleSort('new_price')}
                  >
                    Preço Novo {getSortIcon('new_price')}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer text-right"
                    onClick={() => handleSort('percentage_change')}
                  >
                    Variação {getSortIcon('percentage_change')}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('supplier')}
                  >
                    Fornecedor {getSortIcon('supplier')}
                  </TableHead>
                  <TableHead className="text-right">Faixa de Preço</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.supplyName}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="text-right">{formatDate(item.date)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.old_price ? formatCurrency(item.old_price) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(item.new_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.percentage_change > 0 && <TrendingUp className="w-4 h-4 text-red-500" />}
                        {item.percentage_change < 0 && <TrendingDown className="w-4 h-4 text-green-500" />}
                        <Badge
                          variant={
                            item.percentage_change > 0 ? "destructive" :
                            item.percentage_change < 0 ? "default" : "secondary"
                          }
                        >
                          {item.percentage_change >= 0 ? '+' : ''}{item.percentage_change.toFixed(1)}%
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{item.supplier}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatCurrency(item.min_price)} - {formatCurrency(item.max_price)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredData.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Nenhum registro encontrado
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
