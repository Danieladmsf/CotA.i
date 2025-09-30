
"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import BrandApprovalsTab from './BrandApprovalsTab';
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeepAliveTabsContent } from "@/components/ui/keep-alive-tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  FileBarChart, 
  Loader2, 
  Clock, 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Info, 
  PauseCircle,
  TrendingUp,
  Package2,
  Building2,
  Award,
  Target,
  DollarSign,
  BarChart3,
  Grid3X3,
  List,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  TrendingDown,
  Percent
} from "lucide-react";
import { db } from "@/lib/config/firebase";
import { formatCurrency, isValidImageUrl } from "@/lib/utils";
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, getDocs, Timestamp, FieldValue, updateDoc, collectionGroup } from "firebase/firestore";
import type { Quotation, Offer, ShoppingListItem, Fornecedor, UnitOfMeasure } from "@/types";
import { format, startOfDay, endOfDay, intervalToDuration, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { closeQuotationAndItems } from "@/actions/quotationActions";

import { FIREBASE_COLLECTIONS } from "@/lib/constants/firebase";
import Header from '@/components/shared/Header';

// Utility function to handle preferredBrands as both string and array
const getPreferredBrandsArray = (preferredBrands: string | string[] | undefined): string[] => {
  if (!preferredBrands) return [];
  if (Array.isArray(preferredBrands)) return preferredBrands;
  return preferredBrands.split(',').map(b => b.trim());
};

interface OfferByBrandDisplay {
  brandName: string;
  bestPriceForBrand: number;
  supplierId: string;
  supplierName: string; 
  supplierFotoUrl?: string;
  supplierFotoHint?: string;
  supplierInitials: string; 
}

interface EnhancedProductRow {
  productName: string;
  productId: string;
  unit: UnitOfMeasure;
  requestedQuantity: number;
  bestPricePreferredBrands: number | null; 
  bestPricePreferredBrandsDetails?: { 
    price: number;
    supplierId: string;
    supplierName: string;
    supplierFotoUrl?: string;
    supplierFotoHint?: string;
    supplierInitials: string;
    brandName: string; 
  };
  offersByBrand: OfferByBrandDisplay[];
  notes?: string;
  preferredBrands?: string;
  totalOffers: number;
  lowestPrice: number | null;
  highestPrice: number | null;
  averagePrice: number | null;
}

interface DisplayQuotationDetails {
  id: string; 
  deadline: Timestamp;
  status: Quotation['status'];
  shoppingListItems: ShoppingListItem[];
  offersByProduct: Map<string, Map<string, Offer>>; 
}

interface QuotationStats {
  totalProducts: number;
  totalOffers: number;
  averageOffersPerProduct: number;
  totalEstimatedValue: number;
  productsWithOffers: number;
  productsWithoutOffers: number;
  completionPercentage: number;
  totalSavings: number;
  averageSavingsPercentage: number;
  totalOriginalValue: number;
}



export default function CotacaoClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  // States existentes (mantidos para compatibilidade)
  const [allFetchedQuotations, setAllFetchedQuotations] = useState<Quotation[]>([]);
  const [filteredQuotationsForSelect, setFilteredQuotationsForSelect] = useState<Quotation[]>([]);
  const [selectedDateForFilter, setSelectedDateForFilter] = useState<Date | undefined>(undefined);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string>("");
  const [isLoadingAllQuotations, setIsLoadingAllQuotations] = useState(true);
  const [activeQuotationDetails, setActiveQuotationDetails] = useState<DisplayQuotationDetails | null>(null);
  const [isLoadingSelectedQuotationData, setIsLoadingSelectedQuotationData] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);

  // Novos states para a interface melhorada
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab');
    return tab === 'aprovacoes' ? 'aprovacoes' : 'overview';
  });
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [sortBy, setSortBy] = useState<"name" | "price" | "offers">("name");
  const [filterByBrand, setFilterByBrand] = useState<string>("all");

  const supplierDataCacheRef = useRef(new Map<string, Fornecedor>());
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const closingQuotationsRef = useRef(new Set<string>());
  
  // Lógica existente mantida (handleAutoCloseQuotation e useEffects)
  const handleAutoCloseQuotation = useCallback(async (quotationId: string) => {
    if (!user) {
      return;
    }
    if (closingQuotationsRef.current.has(quotationId)) {
        return;
    }
    closingQuotationsRef.current.add(quotationId);

    const result = await closeQuotationAndItems(quotationId, user.uid);
    
    if (result.success && (result.updatedItemsCount ?? 0) > 0) {
      toast({
        title: "Cotação Encerrada Automaticamente",
        description: `O prazo expirou. ${result.updatedItemsCount ?? 0} item(ns) da lista de compras foram marcados como \'Encerrado\'.`,
      });
    } else if (!result.success) {
     toast({
      title: "Erro ao fechar cotação",
      description: result.error || "Não foi possível atualizar o status da cotação e dos itens.",
      variant: "destructive",
    });
    }
    closingQuotationsRef.current.delete(quotationId);
  }, [toast, user]);

  // UseEffects existentes mantidos...
  useEffect(() => {
    if (authLoading) {
      setIsLoadingAllQuotations(true);
      return;
    }

    if (!user) {
      setIsLoadingAllQuotations(false);
      setAllFetchedQuotations([]);
      return;
    }

    setIsLoadingAllQuotations(true);
    const q = query(
      collection(db, FIREBASE_COLLECTIONS.QUOTATIONS),
      where("userId", "==", user.uid),
      orderBy("shoppingListDate", "desc"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedQuotations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation));
      setAllFetchedQuotations(fetchedQuotations);
      setIsLoadingAllQuotations(false);
    }, (error) => {
      console.error('🔴 [CotacaoClient] Error in quotations listener (with double orderBy):', error);
      toast({title: "Erro ao buscar cotações", description: error.message, variant: "destructive"});
      setIsLoadingAllQuotations(false);
    });
    return () => unsubscribe();
  }, [user, authLoading, toast]);

  useEffect(() => {
    if (isLoadingAllQuotations) return;
    let quotationsToShow: Quotation[];
    if (selectedDateForFilter) {
      quotationsToShow = allFetchedQuotations.filter(q => 
        q.shoppingListDate && isSameDay(q.shoppingListDate.toDate(), selectedDateForFilter)
      );
    } else {
       quotationsToShow = allFetchedQuotations.slice(0, 10);
    }
    setFilteredQuotationsForSelect(quotationsToShow);
  }, [allFetchedQuotations, selectedDateForFilter, isLoadingAllQuotations]);

  useEffect(() => {
    const quotationIdFromUrl = searchParams.get("quotationId");

    if (quotationIdFromUrl) {
      if (selectedQuotationId !== quotationIdFromUrl) {
        setSelectedQuotationId(quotationIdFromUrl);
      }
    } else {
      if (filteredQuotationsForSelect.length > 0 && !isLoadingAllQuotations) {
        let autoSelectedId: string | null = null;
        const openInFiltered = filteredQuotationsForSelect.filter(q => q.status === 'Aberta' || q.status === 'Pausada');
        if (openInFiltered.length > 0) {
          autoSelectedId = openInFiltered[0].id;
        } else if (filteredQuotationsForSelect.length > 0) {
          autoSelectedId = filteredQuotationsForSelect[0].id;
        }

        if (autoSelectedId && selectedQuotationId !== autoSelectedId) {
          setSelectedQuotationId(autoSelectedId);
          router.replace(`/cotacao?quotationId=${autoSelectedId}`, { scroll: false });
        } else if (!autoSelectedId && selectedQuotationId) {
          setSelectedQuotationId("");
          router.replace('/cotacao', { scroll: false });
        }
      } else if (!isLoadingAllQuotations && filteredQuotationsForSelect.length === 0 && selectedQuotationId) {
        setSelectedQuotationId("");
        router.replace('/cotacao', { scroll: false });
      }
    }
  }, [searchParams, filteredQuotationsForSelect, isLoadingAllQuotations, router, selectedQuotationId]);

  useEffect(() => {
    if (!selectedQuotationId) {
      setActiveQuotationDetails(null);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setTimeLeft("");
      setIsDeadlinePassed(false);
      return;
    }

    setIsLoadingSelectedQuotationData(true);
    const listenersToUnsubscribe: (() => void)[] = [];

    const quotationRef = doc(db, FIREBASE_COLLECTIONS.QUOTATIONS, selectedQuotationId);
    const unsubQuotationDoc = onSnapshot(quotationRef, async (quotationSnap) => {
      if (!quotationSnap.exists()) {
        setActiveQuotationDetails(null);
        setIsLoadingSelectedQuotationData(false);
        toast({title: "Cotação não encontrada", description: `A cotação com ID ${selectedQuotationId} não existe.`, variant: "destructive"});
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setTimeLeft(""); setIsDeadlinePassed(false);
        if (searchParams.get("quotationId") === selectedQuotationId) {
            router.replace('/cotacao', { scroll: false });
        }
        return;
      }
      const quotationData = quotationSnap.data() as Quotation;

      if (!quotationData.shoppingListDate) {
        setActiveQuotationDetails(null); setIsLoadingSelectedQuotationData(false);
        toast({title: "Erro na Cotação", description: "Data da lista de compras ausente.", variant: "destructive"});
        return;
      }
      
      const shoppingListQuery = query(
        collection(db, FIREBASE_COLLECTIONS.SHOPPING_LIST_ITEMS),
        where("quotationId", "==", selectedQuotationId)
      );
      
      const shoppingListSnapshot = await getDocs(shoppingListQuery);
      const items = shoppingListSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ShoppingListItem))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      const initialOffersByProduct = new Map<string, Map<string, Offer>>();
      setActiveQuotationDetails({
          id: quotationSnap.id,
          deadline: quotationData.deadline,
          status: quotationData.status,
          shoppingListItems: items,
          offersByProduct: initialOffersByProduct,
      });

      listenersToUnsubscribe.filter(unsub => unsub !== unsubQuotationDoc).forEach(unsub => unsub()); 
      const currentMainListenerIndex = listenersToUnsubscribe.indexOf(unsubQuotationDoc);
      listenersToUnsubscribe.length = currentMainListenerIndex !== -1 ? 1 : 0; 
      if (currentMainListenerIndex === -1) listenersToUnsubscribe.push(unsubQuotationDoc);

      const offersQuery = query(
        collectionGroup(db, 'offers'),
        where('quotationId', '==', selectedQuotationId)
      );

      const unsubOffers = onSnapshot(
        offersQuery,
        async (offersSnapshot) => {
          const allOffers = offersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Offer));
          const supplierIdsToFetch = new Set<string>();

          allOffers.forEach(offer => {
            if (offer.supplierId && !supplierDataCacheRef.current.has(offer.supplierId)) {
              supplierIdsToFetch.add(offer.supplierId);
            }
          });

          if (supplierIdsToFetch.size > 0) {
            const supplierPromises = Array.from(supplierIdsToFetch).map(id =>
              getDoc(doc(db, FIREBASE_COLLECTIONS.FORNECEDORES, id))
            );
            const supplierSnaps = await Promise.all(supplierPromises);
            supplierSnaps.forEach(snap => {
              if (snap.exists()) {
                supplierDataCacheRef.current.set(snap.id, { id: snap.id, ...snap.data() } as Fornecedor);
              }
            });
          }

          const offersByProduct = new Map<string, Map<string, Offer>>();
          for (const offer of allOffers) {
            if (!offersByProduct.has(offer.productId)) {
              offersByProduct.set(offer.productId, new Map());
            }
            offersByProduct.get(offer.productId)!.set(offer.id!, offer);
          }

          setActiveQuotationDetails(prev => {
            if (!prev || prev.id !== selectedQuotationId) return prev;
            return { ...prev, offersByProduct };
          });
        },
        (error) => {
          console.error('🔴 [CotacaoClient] Error in offers collectionGroup listener:', error);
          if (error.code === 'failed-precondition') {
            console.warn('⚠️ Firestore index missing for offers collectionGroup. Please create the index in Firebase Console.');
            console.warn('Query: collectionGroup("offers").where("quotationId", "==", quotationId)');
          }
        }
      );
      
      listenersToUnsubscribe.push(unsubOffers);
      setIsLoadingSelectedQuotationData(false);

    }, (error) => {
      toast({title: "Erro ao carregar dados da cotação", description: error.message, variant: "destructive"})
      setActiveQuotationDetails(null);
      setIsLoadingSelectedQuotationData(false);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setTimeLeft(""); setIsDeadlinePassed(false);
    });

    if (!listenersToUnsubscribe.includes(unsubQuotationDoc)) {
      listenersToUnsubscribe.push(unsubQuotationDoc);
    }
    
    return () => {
      listenersToUnsubscribe.forEach(unsub => unsub());
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [selectedQuotationId, router, searchParams, toast]); 

  useEffect(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (activeQuotationDetails && activeQuotationDetails.status === 'Aberta' && activeQuotationDetails.deadline) {
      const deadlineDate = activeQuotationDetails.deadline.toDate();
      
      const updateTimer = () => {
        const now = new Date();
        const diff = deadlineDate.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeLeft("Prazo Encerrado");
          setIsDeadlinePassed(true);
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          handleAutoCloseQuotation(activeQuotationDetails.id);
          return;
        }

        setIsDeadlinePassed(false);
        const duration = intervalToDuration({ start: now, end: deadlineDate });
        const parts: string[] = [];
        if (duration.days && duration.days > 0) parts.push(`${duration.days}d`);
        if (duration.hours && duration.hours > 0) parts.push(`${duration.hours}h`);
        if (duration.minutes && duration.minutes > 0) parts.push(`${duration.minutes}m`);
        if (duration.seconds && duration.seconds > 0) parts.push(`${duration.seconds}s`);
        
        setTimeLeft(parts.length > 0 ? parts.join(' ') : "Encerrando...");
      };

      updateTimer(); 
      countdownIntervalRef.current = setInterval(updateTimer, 1000);
    } else {
      if (activeQuotationDetails?.status === 'Pausada') {
        setTimeLeft("Pausada");
      } else {
        setTimeLeft("");
      }
      setIsDeadlinePassed(activeQuotationDetails?.status !== 'Aberta');
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [activeQuotationDetails, handleAutoCloseQuotation]); 

  // Handlers existentes mantidos
  const handleSelectQuotationFromDropdown = (quotationId: string) => {
    if (selectedQuotationId !== quotationId) { 
        setSelectedQuotationId(quotationId);
        router.replace(`/cotacao?quotationId=${quotationId}`, { scroll: false });
    }
  };
  
  const handleDateChangeForFilter = (date: Date | undefined) => {
    setSelectedDateForFilter(date);
    if (searchParams.get("quotationId")) {
        router.replace('/cotacao', {scroll: false})
    }
  };

  const navigateQuotation = (direction: 'prev' | 'next') => {
    if (filteredQuotationsForSelect.length < 2) return;
    const currentIndex = filteredQuotationsForSelect.findIndex(q => q.id === selectedQuotationId);
    let nextIndex = -1;
    if (direction === 'prev') {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : filteredQuotationsForSelect.length - 1;
    } else {
      nextIndex = currentIndex < filteredQuotationsForSelect.length - 1 ? currentIndex + 1 : 0;
    }
    if (nextIndex !== -1 && filteredQuotationsForSelect[nextIndex]) {
      handleSelectQuotationFromDropdown(filteredQuotationsForSelect[nextIndex].id);
    }
  };

  // Computed values com informações melhoradas
  const tableProducts = useMemo((): EnhancedProductRow[] => {
    if (!activeQuotationDetails || !activeQuotationDetails.shoppingListItems || activeQuotationDetails.shoppingListItems.length === 0) {
        return [];
    }

    return activeQuotationDetails.shoppingListItems.map(item => {
      const productOffersMap = activeQuotationDetails.offersByProduct.get(item.id); 
      const allOffersForThisProduct: Offer[] = productOffersMap ? Array.from(productOffersMap.values()) : [];

      const validOffers = allOffersForThisProduct.filter(offer => offer.pricePerUnit > 0);
      const prices = validOffers.map(offer => offer.pricePerUnit);
      
      const preferredBrandsArray = item.preferredBrands ? getPreferredBrandsArray(item.preferredBrands) : [];
      
      const bestOfferForPref = allOffersForThisProduct
        .filter(offer => offer.pricePerUnit > 0 && preferredBrandsArray.length > 0 && preferredBrandsArray.includes(offer.brandOffered.toLowerCase()))
        .reduce<Offer | null>((best, current) => {
          if (!best || current.pricePerUnit < best.pricePerUnit) {
            return current;
          }
          return best;
        }, null);

      let bestOfferDetailsForPreferred: EnhancedProductRow['bestPricePreferredBrandsDetails'] | undefined = undefined;
      
      if (bestOfferForPref) {
        const supplierDetails = supplierDataCacheRef.current.get(bestOfferForPref.supplierId);
        bestOfferDetailsForPreferred = {
          price: bestOfferForPref.pricePerUnit,
          supplierId: bestOfferForPref.supplierId,
          supplierName: supplierDetails?.empresa || 'N/A',
          supplierFotoUrl: supplierDetails?.fotoUrl,
          supplierFotoHint: supplierDetails?.fotoHint,
          supplierInitials: supplierDetails?.empresa?.substring(0,2).toUpperCase() || 'XX',
          brandName: bestOfferForPref.brandOffered,
        };
      }

      const offersGroupedByBrand = new Map<string, Offer[]>();
      allOffersForThisProduct.forEach(offer => {
        if (offer.pricePerUnit > 0) { 
          const brand = offer.brandOffered;
          if (!offersGroupedByBrand.has(brand)) {
            offersGroupedByBrand.set(brand, []);
          }
          offersGroupedByBrand.get(brand)!.push(offer);
        }
      });

      const brandDisplays: OfferByBrandDisplay[] = [];
      offersGroupedByBrand.forEach((offersForSpecificBrand, brandName) => {
        if (offersForSpecificBrand.length === 0) return;

        const bestOfferForThisBrand = offersForSpecificBrand.reduce((best, current) => 
          (current.pricePerUnit < best.pricePerUnit) ? current : best
        );
        
        const supplierDetails = supplierDataCacheRef.current.get(bestOfferForThisBrand.supplierId);
        brandDisplays.push({
          brandName: brandName,
          bestPriceForBrand: bestOfferForThisBrand.pricePerUnit,
          supplierId: bestOfferForThisBrand.supplierId,
          supplierName: supplierDetails?.empresa || 'N/A',
          supplierFotoUrl: supplierDetails?.fotoUrl,
          supplierFotoHint: supplierDetails?.fotoHint,
          supplierInitials: supplierDetails?.empresa?.substring(0,2).toUpperCase() || 'XX'
        });
      });
      
      brandDisplays.sort((a,b) => a.bestPriceForBrand - b.bestPriceForBrand);

      return {
        productName: item.name, 
        productId: item.id, 
        unit: item.unit, 
        requestedQuantity: item.quantity,
        bestPricePreferredBrands: bestOfferDetailsForPreferred ? bestOfferDetailsForPreferred.price : null,
        bestPricePreferredBrandsDetails: bestOfferDetailsForPreferred,
        offersByBrand: brandDisplays,
        notes: item.notes,
        preferredBrands: item.preferredBrands,
        totalOffers: validOffers.length,
        lowestPrice: prices.length > 0 ? Math.min(...prices) : null,
        highestPrice: prices.length > 0 ? Math.max(...prices) : null,
        averagePrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
      };
    });
  }, [activeQuotationDetails]);

  // Novas funções computadas para estatísticas
  const quotationStats = useMemo((): QuotationStats => {
    if (!tableProducts.length) {
      return {
        totalProducts: 0,
        totalOffers: 0,
        averageOffersPerProduct: 0,
        totalEstimatedValue: 0,
        productsWithOffers: 0,
        productsWithoutOffers: 0,
        completionPercentage: 0,
        totalSavings: 0,
        averageSavingsPercentage: 0,
        totalOriginalValue: 0,
      };
    }

    const totalProducts = tableProducts.length;
    const totalOffers = tableProducts.reduce((sum, product) => sum + product.totalOffers, 0);
    const productsWithOffers = tableProducts.filter(p => p.totalOffers > 0).length;
    const productsWithoutOffers = totalProducts - productsWithOffers;
    const averageOffersPerProduct = totalProducts > 0 ? totalOffers / totalProducts : 0;
    const completionPercentage = (productsWithOffers / totalProducts) * 100;
    
    // Cálculos de valor e economia
    let totalEstimatedValue = 0;
    let totalOriginalValue = 0;
    let totalSavings = 0;
    
    tableProducts.forEach(product => {
      const bestPrice = product.bestPricePreferredBrands || product.lowestPrice;
      const worstPrice = product.highestPrice; // Preço mais alto como referência original
      
      if (bestPrice) {
        totalEstimatedValue += bestPrice * product.requestedQuantity;
      }
      
      if (worstPrice && bestPrice) {
        // Valor original seria com o preço mais alto
        const originalValue = worstPrice * product.requestedQuantity;
        const currentValue = bestPrice * product.requestedQuantity;
        totalOriginalValue += originalValue;
        totalSavings += originalValue - currentValue;
      } else if (bestPrice) {
        // Se só tem um preço, não há economia calculável diretamente
        // Mas usamos uma estimativa baseada na média de ofertas
        if (product.totalOffers > 1 && product.averagePrice) {
          const estimatedOriginal = product.averagePrice * product.requestedQuantity;
          const currentValue = bestPrice * product.requestedQuantity;
          totalOriginalValue += estimatedOriginal;
          totalSavings += Math.max(0, estimatedOriginal - currentValue);
        } else {
          totalOriginalValue += bestPrice * product.requestedQuantity;
        }
      }
    });

    const averageSavingsPercentage = totalOriginalValue > 0 
      ? (totalSavings / totalOriginalValue) * 100 
      : 0;

    return {
      totalProducts,
      totalOffers,
      averageOffersPerProduct,
      totalEstimatedValue,
      productsWithOffers,
      productsWithoutOffers,
      completionPercentage,
      totalSavings,
      averageSavingsPercentage,
      totalOriginalValue,
    };
  }, [tableProducts]);

  // Filtros e ordenação para os produtos
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = [...tableProducts];

    // Filtro por marca
    if (filterByBrand && filterByBrand !== "all") {
      filtered = filtered.filter(product => 
        product.offersByBrand.some(offer => 
          offer.brandName.toLowerCase().includes(filterByBrand.toLowerCase())
        )
      );
    }

    // Ordenação
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "price":
          const priceA = a.bestPricePreferredBrands || a.lowestPrice || Infinity;
          const priceB = b.bestPricePreferredBrands || b.lowestPrice || Infinity;
          return priceA - priceB;
        case "offers":
          return b.totalOffers - a.totalOffers;
        case "name":
        default:
          return a.productName.localeCompare(b.productName);
      }
    });

    return filtered;
  }, [tableProducts, filterByBrand, sortBy]);

  const isLoading = isLoadingAllQuotations || (isLoadingSelectedQuotationData && !!selectedQuotationId);
  const isQuotationPaused = activeQuotationDetails?.status === 'Pausada';

  return (
    <main className="w-full space-y-8" role="main">
      <Header
        title="Central de Cotações"
        description="Acompanhe ofertas, compare preços e tome decisões inteligentes de compra"
      />

      {/* Seleção de Cotação */}
      <section className="card-professional modern-shadow-xl" aria-labelledby="quotation-selector">
        <header className="p-6 border-b header-modern">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h2 id="quotation-selector" className="text-2xl font-heading font-bold text-gradient">
                Seleção de Cotação
              </h2>
              <p className="text-muted-foreground mt-2">
                Escolha uma cotação para analisar as ofertas recebidas
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="hover-lift">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {selectedDateForFilter ? format(selectedDateForFilter, "dd/MM/yyyy") : "Filtrar por Data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={selectedDateForFilter} onSelect={handleDateChangeForFilter} initialFocus />
                </PopoverContent>
              </Popover>
              
              {selectedDateForFilter && (
                <Button variant="ghost" size="sm" onClick={() => handleDateChangeForFilter(undefined)}>
                  Limpar Filtro
                </Button>
              )}
              
              {timeLeft && selectedQuotationId && activeQuotationDetails && (
                <Badge 
                  variant={isDeadlinePassed ? "destructive" : isQuotationPaused ? "outline" : "secondary"} 
                  className="text-base px-4 py-2 modern-shadow pulse-glow"
                >
                  <Clock className="mr-2 h-5 w-5" /> {timeLeft}
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-6">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigateQuotation('prev')} 
              disabled={filteredQuotationsForSelect.length < 2 || isLoading}
              className="hover-lift"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Select 
              value={selectedQuotationId} 
              onValueChange={handleSelectQuotationFromDropdown} 
              disabled={isLoading || filteredQuotationsForSelect.length === 0}
            >
              <SelectTrigger className="flex-1 input-modern">
                <SelectValue placeholder={isLoadingAllQuotations ? "Carregando..." : "Selecione uma Cotação"} />
              </SelectTrigger>
              <SelectContent className="card-professional">
                {filteredQuotationsForSelect.length === 0 && !isLoadingAllQuotations && 
                  <SelectItem value="no-quote" disabled>
                    Nenhuma cotação para {selectedDateForFilter ? format(selectedDateForFilter, "dd/MM/yy") : "o filtro"}
                  </SelectItem>
                }
                {filteredQuotationsForSelect.map((quotation) => {
                  const quotationsOnSameDay = allFetchedQuotations.filter(q => 
                     q.shoppingListDate && isSameDay(q.shoppingListDate.toDate(), quotation.shoppingListDate.toDate())
                  );
                  
                  const sortedQuotationsOnSameDay = [...quotationsOnSameDay].sort((a,b) => {
                    const aTime = a.createdAt && (a.createdAt as any).toMillis ? (a.createdAt as any).toMillis() : 0;
                    const bTime = b.createdAt && (b.createdAt as any).toMillis ? (b.createdAt as any).toMillis() : 0;
                    return aTime - bTime;
                  });
                  
                  const quotationNumber = sortedQuotationsOnSameDay.findIndex(q => q.id === quotation.id) + 1;
                      
                  const quotationName = quotation.createdAt && quotation.shoppingListDate
                      ? `Cotação #${quotationNumber} de ${format((quotation.shoppingListDate as any).toDate(), "dd/MM/yy")} (${format((quotation.createdAt as any).toDate(), "HH:mm")}) - ${quotation.status}`
                      : `Cotação de ${quotation.shoppingListDate ? format((quotation.shoppingListDate as any).toDate(), "dd/MM/yy") : "Data Inválida"} (Status: ${quotation.status})`;

                  return (
                    <SelectItem key={quotation.id} value={quotation.id}>
                      {quotationName}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigateQuotation('next')} 
              disabled={filteredQuotationsForSelect.length < 2 || isLoading}
              className="hover-lift"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </header>
      </section>

      {/* Conteúdo Principal */}
      {(isLoadingSelectedQuotationData && selectedQuotationId) ? (
        <div className="card-professional modern-shadow-xl p-12 text-center">
          <div className="loading-modern p-8 rounded-lg modern-shadow inline-block">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando detalhes da cotação...</p>
          </div>
        </div>
      ) : isQuotationPaused ? (
        <div className="card-professional modern-shadow-xl p-12 text-center">
          <PauseCircle className="h-16 w-16 text-warning mx-auto mb-6 float" />
          <h3 className="text-2xl font-heading font-bold text-gradient mb-2">Cotação Pausada</h3>
          <p className="text-body-large text-muted-foreground">Esta cotação está temporariamente pausada.</p>
        </div>
      ) : activeQuotationDetails && tableProducts.length > 0 ? (
        <section className="space-y-6">
          {/* Estatísticas e Dashboard */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 card-professional modern-shadow-lg">
              <TabsTrigger 
                value="overview" 
                className="flex items-center gap-2 py-3 nav-item-modern font-heading"
              >
                <BarChart3 className="h-5 w-5 rotate-hover" />
                Visão Geral
              </TabsTrigger>
              <TabsTrigger 
                value="products" 
                className="flex items-center gap-2 py-3 nav-item-modern font-heading"
              >
                <Package2 className="h-5 w-5 rotate-hover" />
                Produtos ({tableProducts.length})
              </TabsTrigger>
              <TabsTrigger 
                value="suppliers" 
                className="flex items-center gap-2 py-3 nav-item-modern font-heading"
              >
                <Building2 className="h-5 w-5 rotate-hover" />
                Fornecedores
              </TabsTrigger>
              <TabsTrigger 
                value="aprovacoes" 
                className="flex items-center gap-2 py-3 nav-item-modern font-heading relative"
              >
                <AlertCircle className="h-5 w-5 rotate-hover text-orange-600" />
                Aprovações
              </TabsTrigger>
            </TabsList>

            {/* Tab: Visão Geral */}
            <KeepAliveTabsContent value="overview" activeTab={activeTab} className="mt-6 bounce-in">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <Card className="card-professional hover-lift">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-caption">Total de Produtos</p>
                        <p className="text-3xl font-bold text-gradient">{quotationStats.totalProducts}</p>
                      </div>
                      <Package2 className="h-8 w-8 text-primary float" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-professional hover-lift">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-caption">Total de Ofertas</p>
                        <p className="text-3xl font-bold text-gradient">{quotationStats.totalOffers}</p>
                      </div>
                      <Award className="h-8 w-8 text-accent float" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-professional hover-lift">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-caption">Completude</p>
                        <p className="text-3xl font-bold text-info">{quotationStats.completionPercentage.toFixed(1)}%</p>
                      </div>
                      <Target className="h-8 w-8 text-info float" />
                    </div>
                    <Progress value={quotationStats.completionPercentage} className="mt-3" />
                  </CardContent>
                </Card>

                <Card className="card-professional hover-lift bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-caption text-orange-700">Valor Original</p>
                        <p className="text-xl font-bold text-orange-600">{formatCurrency(quotationStats.totalOriginalValue)}</p>
                        {quotationStats.totalSavings > 0 && (
                          <p className="text-sm text-muted-foreground mt-1 line-through">
                            Sem negociação
                          </p>
                        )}
                      </div>
                      <Percent className="h-8 w-8 text-orange-500 float" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-professional hover-lift bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-caption text-green-700">Total Economizado</p>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(quotationStats.totalSavings)}</p>
                        {quotationStats.totalSavings > 0 && (
                          <p className="text-sm text-green-600 mt-1">
                            {quotationStats.averageSavingsPercentage.toFixed(1)}% de desconto
                          </p>
                        )}
                      </div>
                      <TrendingDown className="h-8 w-8 text-green-500 float" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="card-professional hover-lift">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-caption">Valor Estimado</p>
                        <p className="text-2xl font-bold text-success">{formatCurrency(quotationStats.totalEstimatedValue)}</p>
                      </div>
                      <DollarSign className="h-8 w-8 text-success float" />
                    </div>
                  </CardContent>
                </Card>

              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="card-professional">
                  <CardHeader>
                    <CardTitle className="text-title text-gradient">Análise de Economia</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {quotationStats.totalSavings > 0 ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-body">Valor economizado:</span>
                            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                              {formatCurrency(quotationStats.totalSavings)}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-body">Percentual de desconto:</span>
                            <Badge variant="outline" className="text-green-600 border-green-300">
                              {quotationStats.averageSavingsPercentage.toFixed(1)}%
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-body">Economia por produto:</span>
                            <Badge variant="secondary">
                              {formatCurrency(quotationStats.totalSavings / quotationStats.totalProducts)}
                            </Badge>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-muted-foreground">
                            {quotationStats.totalOffers === 0 
                              ? "Ainda não há ofertas para calcular economia" 
                              : "Produtos com apenas uma oferta cada"}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-professional">
                  <CardHeader>
                    <CardTitle className="text-title text-gradient">Distribuição de Ofertas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-body">Produtos com ofertas:</span>
                        <Badge variant="secondary">{quotationStats.productsWithOffers}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-body">Produtos sem ofertas:</span>
                        <Badge variant="destructive">{quotationStats.productsWithoutOffers}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-body">Média de ofertas por produto:</span>
                        <Badge variant="outline">{quotationStats.averageOffersPerProduct.toFixed(1)}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-professional">
                  <CardHeader>
                    <CardTitle className="text-title text-gradient">Status da Cotação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-primary"></div>
                        <span className="text-body">Status: {activeQuotationDetails.status}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-body">{timeLeft || "Sem prazo ativo"}</span>
                      </div>
                      {activeQuotationDetails.deadline && (
                        <div className="text-caption">
                          Prazo: {format(activeQuotationDetails.deadline.toDate(), "dd/MM/yyyy 'às' HH:mm")}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </KeepAliveTabsContent>

            {/* Tab: Produtos */}
            <KeepAliveTabsContent value="products" activeTab={activeTab} className="mt-6 bounce-in">
              <div className="space-y-6">
                {/* Controles de Visualização */}
                <Card className="card-professional">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4 text-muted-foreground" />
                          <Select value={filterByBrand} onValueChange={setFilterByBrand}>
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Filtrar por marca" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todas as marcas</SelectItem>
                              {Array.from(new Set(tableProducts.flatMap(p => p.offersByBrand.map(o => o.brandName))))
                                .sort()
                                .map(brand => (
                                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-caption">Ordenar por:</span>
                          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="name">Nome</SelectItem>
                              <SelectItem value="price">Preço</SelectItem>
                              <SelectItem value="offers">Ofertas</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant={viewMode === "table" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setViewMode("table")}
                        >
                          <List className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === "grid" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setViewMode("grid")}
                        >
                          <Grid3X3 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Visualização dos Produtos */}
                {viewMode === "table" ? (
                  <Card className="card-professional">
                    <div className="overflow-x-auto">
                      <Table className="table-modern">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-card z-20 min-w-[300px] font-heading">
                              Produto
                            </TableHead>
                            <TableHead className="text-center font-heading">Melhor Oferta</TableHead>
                            <TableHead className="text-center font-heading">Total Ofertas</TableHead>
                            <TableHead className="font-heading">Ofertas por Marca</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAndSortedProducts.map((product) => (
                            <TableRow key={product.productId} className="table-row-modern">
                              <TableCell className="sticky left-0 bg-card z-10 font-medium align-top">
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-base">{product.productName}</h4>
                                  <p className="text-caption">Pedido: {product.requestedQuantity} {product.unit}</p>
                                  {product.preferredBrands && (
                                    <p className="text-caption">
                                      Marcas Pref.: {getPreferredBrandsArray(product.preferredBrands).join(', ')}
                                    </p>
                                  )}
                                  {product.notes && (
                                    <p className="text-caption italic">Obs: {product.notes}</p>
                                  )}
                                </div>
                              </TableCell>
                              
                              <TableCell className="text-center align-top">
                                {product.bestPricePreferredBrandsDetails ? (
                                  <div className="flex flex-col items-center gap-2">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Avatar className="h-10 w-10 scale-hover">
                                            <Image 
                                              src={isValidImageUrl(product.bestPricePreferredBrandsDetails.supplierFotoUrl) ? product.bestPricePreferredBrandsDetails.supplierFotoUrl! : 'https://placehold.co/40x40.png'} 
                                              alt={product.bestPricePreferredBrandsDetails.supplierName} 
                                              width={40} 
                                              height={40} 
                                              className="object-cover" 
                                            />
                                            <AvatarFallback>{product.bestPricePreferredBrandsDetails.supplierInitials}</AvatarFallback>
                                          </Avatar>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="font-semibold">{product.bestPricePreferredBrandsDetails.supplierName}</p>
                                          <p className="text-xs">Marca: {product.bestPricePreferredBrandsDetails.brandName}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    <p className="text-base font-bold text-primary">{formatCurrency(product.bestPricePreferredBrandsDetails.price)}</p>
                                  </div>
                                ) : product.lowestPrice ? (
                                  <p className="text-base font-bold text-muted-foreground">{formatCurrency(product.lowestPrice)}</p>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>

                              <TableCell className="text-center align-top">
                                <Badge variant={product.totalOffers > 0 ? "secondary" : "destructive"}>
                                  {product.totalOffers}
                                </Badge>
                              </TableCell>

                              <TableCell className="align-top">
                                {product.offersByBrand.length > 0 ? (
                                  <div className="flex flex-wrap gap-4">
                                    {product.offersByBrand.slice(0, 5).map((brandOffer, index) => (
                                      <div key={`${product.productId}-${brandOffer.brandName}-${index}`} className="flex flex-col items-center text-center min-w-[80px]">
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Avatar className="h-8 w-8 scale-hover">
                                                <Image 
                                                  src={isValidImageUrl(brandOffer.supplierFotoUrl) ? brandOffer.supplierFotoUrl! : 'https://placehold.co/40x40.png'} 
                                                  alt={brandOffer.supplierName} 
                                                  width={32} 
                                                  height={32} 
                                                  className="object-cover" 
                                                />
                                                <AvatarFallback className="text-xs">{brandOffer.supplierInitials}</AvatarFallback>
                                              </Avatar>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p className="font-semibold">{brandOffer.supplierName}</p>
                                              <p className="text-xs">Marca: {brandOffer.brandName}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                        <p className="text-sm font-semibold text-primary mt-1">{formatCurrency(brandOffer.bestPriceForBrand)}</p>
                                        <p className="text-xs text-muted-foreground truncate max-w-[80px]">{brandOffer.brandName}</p>
                                      </div>
                                    ))}
                                    {product.offersByBrand.length > 5 && (
                                      <div className="flex items-center text-muted-foreground">
                                        <span className="text-xs">+{product.offersByBrand.length - 5} mais</span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Nenhuma oferta</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAndSortedProducts.map((product) => (
                      <Card key={product.productId} className="card-professional hover-lift">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg font-heading">{product.productName}</CardTitle>
                          <p className="text-caption">Pedido: {product.requestedQuantity} {product.unit}</p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {product.bestPricePreferredBrandsDetails && (
                            <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg">
                              <Avatar className="h-10 w-10 scale-hover">
                                <Image 
                                  src={isValidImageUrl(product.bestPricePreferredBrandsDetails.supplierFotoUrl) ? product.bestPricePreferredBrandsDetails.supplierFotoUrl! : 'https://placehold.co/40x40.png'} 
                                  alt={product.bestPricePreferredBrandsDetails.supplierName} 
                                  width={40} 
                                  height={40} 
                                  className="object-cover" 
                                />
                                <AvatarFallback>{product.bestPricePreferredBrandsDetails.supplierInitials}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold">{formatCurrency(product.bestPricePreferredBrandsDetails.price)}</p>
                                <p className="text-caption">{product.bestPricePreferredBrandsDetails.supplierName}</p>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex justify-between items-center">
                            <span className="text-caption">Total de ofertas:</span>
                            <Badge variant={product.totalOffers > 0 ? "secondary" : "destructive"}>
                              {product.totalOffers}
                            </Badge>
                          </div>

                          {product.offersByBrand.length > 0 && (
                            <div>
                              <p className="text-caption mb-2">Outras ofertas:</p>
                              <div className="space-y-2">
                                {product.offersByBrand.slice(0, 3).map((offer, index) => (
                                  <div key={index} className="flex justify-between items-center text-sm">
                                    <span className="truncate">{offer.brandName}</span>
                                    <span className="font-semibold">{formatCurrency(offer.bestPriceForBrand)}</span>
                                  </div>
                                ))}
                                {product.offersByBrand.length > 3 && (
                                  <p className="text-xs text-muted-foreground">+{product.offersByBrand.length - 3} ofertas</p>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </KeepAliveTabsContent>

            {/* Tab: Fornecedores */}
            <KeepAliveTabsContent value="suppliers" activeTab={activeTab} className="mt-6 bounce-in">
              <Card className="card-professional">
                <CardHeader>
                  <CardTitle className="text-title text-gradient">Participação dos Fornecedores</CardTitle>
                  <p className="text-body text-muted-foreground">
                    Fornecedores que enviaram ofertas para esta cotação
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from(
                      tableProducts.reduce((suppliers, product) => {
                        product.offersByBrand.forEach(offer => {
                          if (!suppliers.has(offer.supplierId)) {
                            suppliers.set(offer.supplierId, {
                              id: offer.supplierId,
                              name: offer.supplierName,
                              initials: offer.supplierInitials,
                              fotoUrl: offer.supplierFotoUrl,
                              totalOffers: 0,
                              products: new Set()
                            });
                          }
                          const supplier = suppliers.get(offer.supplierId)!;
                          supplier.totalOffers++;
                          supplier.products.add(product.productId);
                        });
                        return suppliers;
                      }, new Map()).values()
                    ).map(supplier => (
                      <div key={supplier.id} className="flex items-center gap-3 p-4 rounded-lg border hover-lift transition-all">
                        <Avatar className="h-12 w-12 scale-hover">
                          <Image 
                            src={isValidImageUrl(supplier.fotoUrl) ? supplier.fotoUrl : 'https://placehold.co/40x40.png'} 
                            alt={supplier.name} 
                            width={48} 
                            height={48} 
                            className="object-cover" 
                          />
                          <AvatarFallback>{supplier.initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h4 className="font-semibold">{supplier.name}</h4>
                          <p className="text-caption">{supplier.totalOffers} ofertas</p>
                          <p className="text-caption">{supplier.products.size} produtos</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </KeepAliveTabsContent>

            {/* Tab: Aprovações */}
            <KeepAliveTabsContent value="aprovacoes" activeTab={activeTab} className="mt-6 bounce-in">
              <BrandApprovalsTab />
            </KeepAliveTabsContent>
          </Tabs>
        </section>
      ) : selectedQuotationId ? (
        <div className="card-professional modern-shadow-xl p-12 text-center">
          <Package2 className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
          <h3 className="text-2xl font-heading font-bold mb-2">Nenhum Produto Encontrado</h3>
          <p className="text-body-large text-muted-foreground">
            Esta cotação não possui itens ou ainda está sendo carregada.
          </p>
        </div>
      ) : (
        <div className="card-professional modern-shadow-xl p-12 text-center">
          <Eye className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
          <h3 className="text-2xl font-heading font-bold mb-2">Selecione uma Cotação</h3>
          <p className="text-body-large text-muted-foreground">
            Escolha uma data ou cotação acima para visualizar os detalhes das ofertas.
          </p>
        </div>
      )}
    </main>
  );
}
