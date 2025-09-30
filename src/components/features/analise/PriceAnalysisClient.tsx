
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Image from "next/image";

import {
  Loader2,
  Clock,
  Calendar as CalendarIcon,
  Download,
  FileText,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  RefreshCw,
} from "lucide-react";

import { format, subDays, isSameDay, intervalToDuration } from "date-fns";
import { ptBR } from "date-fns/locale";
import { db } from '@/lib/config/firebase';
import { collection, query, getDocs, orderBy, where, Timestamp, onSnapshot, doc, getDoc } from 'firebase/firestore';
import type { Supply, Offer, Quotation, Fornecedor, ShoppingListItem, UnitOfMeasure } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { closeQuotationAndItems } from "@/actions/quotationActions";

const QUOTATIONS_COLLECTION = 'quotations';
const SHOPPING_LIST_ITEMS_COLLECTION = 'shopping_list_items';
const FORNECEDORES_COLLECTION = 'fornecedores';


interface PriceAnalysisItem {
  id: string;
  name: string;
  unit: UnitOfMeasure;
  requestedQuantity: number;
  offersByBrand: {
    brandName: string;
    bestPriceForBrand: number;
    supplierId: string;
    supplierName: string;
    supplierFotoUrl?: string;
    supplierFotoHint?: string;
    supplierInitials: string;
  }[];
  totalOffers: number;
  lowestPrice: number | null;
  averagePrice: number | null;
}

interface QuotationStats {
  totalProducts: number;
  totalOffers: number;
  productsWithOffers: number;
  completionPercentage: number;
  totalEstimatedValue: number;
  totalOriginalValue: number;
  totalSavings: number;
  averageSavingsPercentage: number;
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return "R$ 0,00";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const isValidImageUrl = (url?: string): url is string => {
  return !!url && (url.startsWith('http') || url.startsWith('data:'));
};

export default function PriceAnalysisClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({ 
    from: subDays(new Date(), 30), 
    to: new Date() 
  });
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string>('');
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  
  const [analysisData, setAnalysisData] = useState<PriceAnalysisItem[]>([]);
  const [supplierDataCache, setSupplierDataCache] = useState<Map<string, Fornecedor>>(new Map());
  
  const [loadingQuotations, setLoadingQuotations] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  
  const [timeLeft, setTimeLeft] = useState("");
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
  
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const closingQuotationsRef = useRef(new Set<string>());

  const handleAutoCloseQuotation = useCallback(async (quotationId: string) => {
    if (!user) {
      console.error("Cannot auto-close quotation, user not authenticated.");
      return;
    }
    if (closingQuotationsRef.current.has(quotationId)) return;
    closingQuotationsRef.current.add(quotationId);
    
    const result = await closeQuotationAndItems(quotationId, user.uid);
    if (result.success && (result.updatedItemsCount ?? 0) > 0) {
      toast({
        title: "Cotação Encerrada Automaticamente",
        description: `O prazo expirou. ${result.updatedItemsCount} item(ns) foram marcados como 'Encerrado'.`,
      });
    } else if (!result.success) {
      toast({ title: "Erro ao fechar cotação", description: result.error, variant: "destructive" });
    }
    closingQuotationsRef.current.delete(quotationId);
  }, [toast, user]);
  
  // Fetch quotations list
  useEffect(() => {
    console.log('📊 [ANALYSIS] Fetch quotations useEffect triggered', { user: !!user, dateRange });

    if (!user) {
      console.log('⚠️ [ANALYSIS] No user, skipping quotations fetch');
      setQuotations([]);
      setLoadingQuotations(false);
      return;
    }

    console.log('🔄 [ANALYSIS] Starting quotations fetch...');
    setLoadingQuotations(true);

    const q = query(
      collection(db, QUOTATIONS_COLLECTION),
      where("userId", "==", user.uid),
      where('createdAt', '>=', Timestamp.fromDate(dateRange?.from || subDays(new Date(), 30))),
      where('createdAt', '<=', Timestamp.fromDate(dateRange?.to || new Date())),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('✅ [ANALYSIS] Quotations snapshot received', { count: snapshot.docs.length });
      const fetchedQuotations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation));
      setQuotations(fetchedQuotations);

      const currentSelectionExists = fetchedQuotations.some(q => q.id === selectedQuotationId);
      console.log('🔍 [ANALYSIS] Current selection check', {
        selectedQuotationId,
        currentSelectionExists,
        quotationsCount: fetchedQuotations.length
      });

      if (!currentSelectionExists && fetchedQuotations.length > 0) {
        const newId = fetchedQuotations[0].id;
        console.log('🎯 [ANALYSIS] Auto-selecting first quotation:', newId);
        setSelectedQuotationId(newId);
        router.replace(`/analise-de-precos?quotationId=${newId}`, { scroll: false });
      } else if (fetchedQuotations.length === 0) {
        console.log('⚠️ [ANALYSIS] No quotations found');
        setSelectedQuotationId('');
        router.replace('/analise-de-precos', { scroll: false });
      }

      setLoadingQuotations(false);
      console.log('✅ [ANALYSIS] Quotations loading complete');
    }, (error) => {
      console.error("❌ [ANALYSIS] Error fetching quotations list:", error);
      toast({ title: "Erro ao buscar cotações", description: error.message, variant: "destructive" });
      setLoadingQuotations(false);
    });

    return () => unsubscribe();
  }, [dateRange, toast, router, selectedQuotationId, user]);
  
  // Set selected quotation from URL or first in list
  useEffect(() => {
    const urlQuotationId = searchParams.get('quotationId');
    console.log('🔗 [ANALYSIS] URL quotation ID check', { urlQuotationId, quotationsCount: quotations.length });

    if (urlQuotationId) {
        console.log('✅ [ANALYSIS] Setting quotation from URL:', urlQuotationId);
        setSelectedQuotationId(urlQuotationId);
    } else if (quotations.length > 0) {
        console.log('✅ [ANALYSIS] Auto-selecting first quotation:', quotations[0].id);
        setSelectedQuotationId(quotations[0].id);
    }
  }, [searchParams, quotations]);

  // Fetch and analyze data for the selected quotation
  useEffect(() => {
    console.log('📈 [ANALYSIS] Analyze quotation useEffect triggered', { selectedQuotationId });

    if (!selectedQuotationId) {
      console.log('⚠️ [ANALYSIS] No quotation selected, clearing data');
      setSelectedQuotation(null);
      setAnalysisData([]);
      return;
    }

    console.log('🔄 [ANALYSIS] Starting analysis for quotation:', selectedQuotationId);
    setLoadingAnalysis(true);

    const unsubQuotation = onSnapshot(doc(db, QUOTATIONS_COLLECTION, selectedQuotationId), (docSnap) => {
      console.log('📄 [ANALYSIS] Quotation document snapshot', { exists: docSnap.exists() });

      if (docSnap.exists()) {
        const quotationData = { id: docSnap.id, ...docSnap.data() } as Quotation;
        console.log('✅ [ANALYSIS] Quotation data loaded', { id: quotationData.id, status: quotationData.status });
        setSelectedQuotation(quotationData);

        if (quotationData.status === 'Aberta' && quotationData.deadline.toDate() < new Date()) {
          console.log('⏰ [ANALYSIS] Deadline passed, auto-closing quotation');
          handleAutoCloseQuotation(quotationData.id);
        }

      } else {
        console.error('❌ [ANALYSIS] Quotation document not found');
        toast({ title: "Erro", description: "A cotação selecionada não foi encontrada.", variant: "destructive" });
        setSelectedQuotation(null);
      }
    });

    const performAnalysis = async () => {
        try {
            console.log('🔍 [ANALYSIS] Fetching shopping list items...');
            const itemsQuery = query(collection(db, SHOPPING_LIST_ITEMS_COLLECTION), where("quotationId", "==", selectedQuotationId));
            const itemsSnapshot = await getDocs(itemsQuery);
            const items = itemsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ShoppingListItem));
            console.log('✅ [ANALYSIS] Shopping list items fetched', { count: items.length });

            const newAnalysisData: PriceAnalysisItem[] = [];
            const newSupplierCache = new Map(supplierDataCache);

            for (const item of items) {
                const offersQuery = query(collection(db, `quotations/${selectedQuotationId}/products/${item.id}/offers`));
                const offersSnapshot = await getDocs(offersQuery);
                const offers = offersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Offer));
                
                const validOffers = offers.filter(o => o.pricePerUnit > 0);
                const prices = validOffers.map(o => o.pricePerUnit);

                for (const offer of validOffers) {
                  if (offer.supplierId && !newSupplierCache.has(offer.supplierId)) {
                    const supplierDoc = await getDoc(doc(db, FORNECEDORES_COLLECTION, offer.supplierId));
                    if (supplierDoc.exists()) {
                      newSupplierCache.set(supplierDoc.id, { id: supplierDoc.id, ...supplierDoc.data() } as Fornecedor);
                    }
                  }
                }

                const offersByBrand = new Map<string, { price: number; supplierId: string }[]>();
                validOffers.forEach(o => {
                  const brandOffers = offersByBrand.get(o.brandOffered) || [];
                  brandOffers.push({ price: o.pricePerUnit, supplierId: o.supplierId });
                  offersByBrand.set(o.brandOffered, brandOffers);
                });

                const analysisItem: PriceAnalysisItem = {
                  id: item.id,
                  name: item.name,
                  unit: item.unit,
                  requestedQuantity: item.quantity,
                  totalOffers: validOffers.length,
                  lowestPrice: prices.length > 0 ? Math.min(...prices) : null,
                  averagePrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
                  offersByBrand: Array.from(offersByBrand.entries()).map(([brandName, brandOffers]) => {
                    const bestOfferForBrand = brandOffers.reduce((best, current) => current.price < best.price ? current : best);
                    const supplierDetails = newSupplierCache.get(bestOfferForBrand.supplierId);
                    return {
                      brandName,
                      bestPriceForBrand: bestOfferForBrand.price,
                      supplierId: bestOfferForBrand.supplierId,
                      supplierName: supplierDetails?.empresa || 'N/A',
                      supplierFotoUrl: supplierDetails?.fotoUrl,
                      supplierFotoHint: supplierDetails?.fotoHint,
                      supplierInitials: supplierDetails?.empresa?.substring(0,2).toUpperCase() || '??',
                    };
                  }).sort((a, b) => a.bestPriceForBrand - b.bestPriceForBrand),
                };
                newAnalysisData.push(analysisItem);
            }
            console.log('✅ [ANALYSIS] Analysis complete', { productsAnalyzed: newAnalysisData.length });
            setAnalysisData(newAnalysisData.sort((a, b) => a.name.localeCompare(b.name)));
            setSupplierDataCache(newSupplierCache);
        } catch (error) {
            console.error("❌ [ANALYSIS] Error performing analysis:", error);
            toast({ title: "Erro na Análise", description: "Não foi possível carregar os detalhes da cotação.", variant: "destructive" });
        } finally {
            console.log('🏁 [ANALYSIS] Loading analysis complete');
            setLoadingAnalysis(false);
        }
    };

    console.log('🚀 [ANALYSIS] Calling performAnalysis...');
    performAnalysis();

    return () => {
      console.log('🧹 [ANALYSIS] Cleaning up quotation subscription');
      unsubQuotation();
    };
  }, [selectedQuotationId, toast, handleAutoCloseQuotation]); // Removed supplierDataCache to prevent infinite loop
  
  // Countdown Timer
  useEffect(() => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    if (selectedQuotation?.status === 'Aberta' && selectedQuotation.deadline) {
      const deadlineDate = selectedQuotation.deadline.toDate();
      const updateTimer = () => {
        const now = new Date();
        const diff = deadlineDate.getTime() - now.getTime();
        if (diff <= 0) {
          setTimeLeft("Prazo Encerrado");
          setIsDeadlinePassed(true);
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          handleAutoCloseQuotation(selectedQuotation.id);
        } else {
          setIsDeadlinePassed(false);
          const duration = intervalToDuration({ start: now, end: deadlineDate });
          const parts: string[] = [];
          if (duration.days && duration.days > 0) parts.push(`${duration.days}d`);
          if (duration.hours && duration.hours > 0) parts.push(`${duration.hours}h`);
          if (duration.minutes && duration.minutes > 0) parts.push(`${duration.minutes}m`);
          setTimeLeft(parts.join(' ') || `${duration.seconds}s`);
        }
      };
      updateTimer();
      countdownIntervalRef.current = setInterval(updateTimer, 1000);
    } else {
      setTimeLeft(selectedQuotation?.status === 'Pausada' ? "Pausada" : "");
      setIsDeadlinePassed(selectedQuotation?.status !== 'Aberta');
    }
    return () => { if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current) };
  }, [selectedQuotation, handleAutoCloseQuotation]);

  const stats = useMemo((): QuotationStats => {
    const totalProducts = analysisData.length;
    if (totalProducts === 0) return { totalProducts: 0, totalOffers: 0, productsWithOffers: 0, completionPercentage: 0, totalEstimatedValue: 0, totalOriginalValue: 0, totalSavings: 0, averageSavingsPercentage: 0 };
    
    const productsWithOffers = analysisData.filter(p => p.totalOffers > 0).length;
    const totalOffers = analysisData.reduce((sum, p) => sum + p.totalOffers, 0);

    let totalEstimatedValue = 0;
    let totalOriginalValue = 0;

    analysisData.forEach(p => {
        if(p.lowestPrice) {
            totalEstimatedValue += p.lowestPrice * p.requestedQuantity;
        }
        if(p.averagePrice) {
            totalOriginalValue += p.averagePrice * p.requestedQuantity;
        } else if (p.lowestPrice) {
            totalOriginalValue += p.lowestPrice * p.requestedQuantity; // fallback if no average
        }
    });

    const totalSavings = totalOriginalValue - totalEstimatedValue;

    return {
      totalProducts,
      totalOffers,
      productsWithOffers,
      completionPercentage: (productsWithOffers / totalProducts) * 100,
      totalEstimatedValue,
      totalOriginalValue,
      totalSavings,
      averageSavingsPercentage: totalOriginalValue > 0 ? (totalSavings / totalOriginalValue) * 100 : 0
    };
  }, [analysisData]);
  
  const handleSelectQuotationFromDropdown = (id: string) => {
    setSelectedQuotationId(id);
    router.replace(`/analise-de-precos?quotationId=${id}`, { scroll: false });
  };
  
  const navigateQuotation = (direction: 'prev' | 'next') => {
    if (quotations.length < 2) return;
    const currentIndex = quotations.findIndex(q => q.id === selectedQuotationId);
    let nextIndex;
    if (direction === 'prev') {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : quotations.length - 1;
    } else {
        nextIndex = currentIndex < quotations.length - 1 ? currentIndex + 1 : 0;
    }
    handleSelectQuotationFromDropdown(quotations[nextIndex].id);
  };
  
  const isLoading = loadingQuotations || loadingAnalysis;

  console.log('🎨 [ANALYSIS] Rendering component', {
    isLoading,
    loadingQuotations,
    loadingAnalysis,
    quotationsCount: quotations.length,
    selectedQuotationId,
    hasSelectedQuotation: !!selectedQuotation,
    analysisDataCount: analysisData.length
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div className="flex items-center gap-2">
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
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="range" selected={dateRange} onSelect={setDateRange} initialFocus />
                </PopoverContent>
              </Popover>
              {timeLeft && <Badge variant={isDeadlinePassed ? "destructive" : "secondary"}>{timeLeft}</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" size="icon" onClick={() => navigateQuotation('prev')} disabled={quotations.length < 2 || isLoading}><ChevronLeft className="h-4 w-4" /></Button>
            <Select value={selectedQuotationId} onValueChange={handleSelectQuotationFromDropdown} disabled={loadingQuotations || quotations.length === 0}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={loadingQuotations ? "Carregando..." : "Nenhuma cotação encontrada"} />
              </SelectTrigger>
              <SelectContent>
                {quotations.map(q => <SelectItem key={q.id} value={q.id}>{`Cotação de ${format(q.shoppingListDate.toDate(), "dd/MM/yy HH:mm")} (Status: ${q.status})`}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => navigateQuotation('next')} disabled={quotations.length < 2 || isLoading}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
      </Card>
      
      {isLoading ? (
        <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>
      ) : !selectedQuotation ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Selecione uma cotação para ver a análise.</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Valor Inicial (Médio)</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatCurrency(stats.totalOriginalValue)}</div><p className="text-xs text-muted-foreground">Baseado no preço médio das ofertas</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Economizado</CardTitle><TrendingDown className="h-4 w-4 text-green-500" /></CardHeader>
              <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalSavings)}</div><p className="text-xs text-muted-foreground">{stats.averageSavingsPercentage.toFixed(1)}% de economia</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Valor Final (Melhor Preço)</CardTitle><DollarSign className="h-4 w-4 text-green-500" /></CardHeader>
              <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalEstimatedValue)}</div><p className="text-xs text-muted-foreground">Considerando as melhores ofertas</p></CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader><CardTitle>Resumo da Cotação</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Completude</p>
                    <p className="text-3xl font-bold">{stats.completionPercentage.toFixed(0)}%</p>
                    <Progress value={stats.completionPercentage} className="w-3/4 mt-2"/>
                </div>
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Produtos com Oferta</p>
                    <p className="text-3xl font-bold">{stats.productsWithOffers}</p>
                    <p className="text-xs text-muted-foreground">de {stats.totalProducts} produtos</p>
                </div>
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Total de Ofertas</p>
                    <p className="text-3xl font-bold">{stats.totalOffers}</p>
                </div>
                 <div className="flex flex-col items-center justify-center p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={isDeadlinePassed || selectedQuotation.status !== 'Aberta' ? 'destructive' : 'default'} className="text-lg mt-2">{selectedQuotation.status}</Badge>
                </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>Análise de Produtos</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Produto</TableHead>
                    <TableHead className="text-center">Ofertas</TableHead>
                    <TableHead className="text-center">Melhor Preço</TableHead>
                    <TableHead className="text-center">Preço Médio</TableHead>
                    <TableHead>Marcas e Preços</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysisData.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}<br/><span className="text-xs text-muted-foreground">Pedido: {item.requestedQuantity} {item.unit}</span></TableCell>
                      <TableCell className="text-center">{item.totalOffers}</TableCell>
                      <TableCell className="text-center font-semibold text-green-600">{formatCurrency(item.lowestPrice)}</TableCell>
                      <TableCell className="text-center">{formatCurrency(item.averagePrice)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-4">
                          {item.offersByBrand.map(offer => (
                            <TooltipProvider key={offer.brandName}>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="flex flex-col items-center">
                                    <Avatar className="h-8 w-8">
                                      <Image src={isValidImageUrl(offer.supplierFotoUrl) ? offer.supplierFotoUrl : 'https://placehold.co/32x32.png'} alt={offer.supplierName} width={32} height={32} />
                                      <AvatarFallback>{offer.supplierInitials}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs mt-1">{formatCurrency(offer.bestPriceForBrand)}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-semibold">{offer.supplierName}</p>
                                  <p>Marca: {offer.brandName}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
