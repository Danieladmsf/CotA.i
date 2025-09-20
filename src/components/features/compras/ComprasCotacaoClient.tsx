
"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
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
import { FileText, Loader2, Clock, CalendarDays, ChevronLeft, ChevronRight, Info, PauseCircle } from "lucide-react";
import { db } from "@/lib/config/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, getDocs, Timestamp, FieldValue, updateDoc } from "firebase/firestore";
import type { Quotation, Offer, ShoppingListItem, Fornecedor, UnitOfMeasure } from "@/types";
import { format, startOfDay, endOfDay, intervalToDuration, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { closeQuotationAndItems } from "@/actions/quotationActions";
import { formatCurrency } from "@/lib/utils";
import { FIREBASE_COLLECTIONS } from "@/lib/constants/firebase";



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
}

interface DisplayQuotationDetails {
  id: string; 
  deadline: Timestamp;
  status: Quotation['status'];
  shoppingListItems: ShoppingListItem[];
  offersByProduct: Map<string, Map<string, Offer>>; 
}


export default function ComprasCotacaoClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [allFetchedQuotations, setAllFetchedQuotations] = useState<Quotation[]>([]);
  const [filteredQuotationsForSelect, setFilteredQuotationsForSelect] = useState<Quotation[]>([]);
  const [selectedDateForFilter, setSelectedDateForFilter] = useState<Date | undefined>(undefined);
  
  const [selectedQuotationId, setSelectedQuotationId] = useState<string>("");
  const [isLoadingAllQuotations, setIsLoadingAllQuotations] = useState(true);
  
  const [activeQuotationDetails, setActiveQuotationDetails] = useState<DisplayQuotationDetails | null>(null);
  const [isLoadingSelectedQuotationData, setIsLoadingSelectedQuotationData] = useState(false);
  
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);

  const supplierDataCacheRef = useRef(new Map<string, Fornecedor>());
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const closingQuotationsRef = useRef(new Set<string>());
  
  const handleAutoCloseQuotation = useCallback(async (quotationId: string) => {
    if (closingQuotationsRef.current.has(quotationId)) {
        console.log(`[CotacaoClient] Auto-close for ${quotationId} already in progress. Skipping.`);
        return;
    }
    console.log(`[CotacaoClient] Deadline passed for quotation ${quotationId}. Triggering auto-close action from cotacao page.`);
    closingQuotationsRef.current.add(quotationId);

    const result = await closeQuotationAndItems(quotationId);
    
    if (result.success && (result.updatedItemsCount ?? 0) > 0) {
      toast({
        title: "Cotação Encerrada Automaticamente",
        description: `O prazo expirou. ${result.updatedItemsCount ?? 0} item(ns) da lista de compras foram marcados como 'Encerrado'.`,
      });
    } else if (!result.success) {
      console.error("CotacaoClient: Failed to auto-close quotation:", result.error);
     toast({
      title: "Erro ao fechar cotação",
      description: result.error || "Não foi possível atualizar o status da cotação e dos itens.",
      variant: "destructive",
    });
    }
    closingQuotationsRef.current.delete(quotationId);
  }, [toast]);


  useEffect(() => {
    setIsLoadingAllQuotations(true);
    const q = query(
      collection(db, FIREBASE_COLLECTIONS.QUOTATIONS),
      orderBy("shoppingListDate", "desc"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedQuotations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation));
      setAllFetchedQuotations(fetchedQuotations);
      setIsLoadingAllQuotations(false);
    }, (error) => {
      console.error("Error fetching all quotations:", error);
      toast({title: "Erro ao buscar cotações", description: error.message, variant: "destructive"});
      setIsLoadingAllQuotations(false);
    });
    return () => unsubscribe();
  }, [toast]);

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

      for (const item of items) {
        const offersPath = `quotations/${selectedQuotationId}/products/${item.id}/offers`;
        const offersQuery = query(collection(db, offersPath));
        
        const unsubProductOffers = onSnapshot(offersQuery, async (offersSnapshot) => {
          const productOffersMap = new Map<string, Offer>();
          const supplierIdsToFetchDetails = new Set<string>();

          offersSnapshot.forEach(offerDoc => {
            const offerData = offerDoc.data();
            const offer: Offer = {
              id: offerDoc.id,
              supplierId: offerData.supplierId,
              supplierName: offerData.supplierName,
              supplierInitials: offerData.supplierInitials,
              pricePerUnit: offerData.pricePerUnit,
              brandOffered: offerData.brandOffered,
              packagingDescription: offerData.packagingDescription,
              unitsInPackaging: offerData.unitsInPackaging,
              totalPackagingPrice: offerData.totalPackagingPrice,
              updatedAt: offerData.updatedAt,
              productId: offerData.productId,
            };
            productOffersMap.set(offerDoc.id, offer); 
            if (offer.supplierId && !supplierDataCacheRef.current.has(offer.supplierId)) {
              supplierIdsToFetchDetails.add(offer.supplierId);
            }
          });

          if (supplierIdsToFetchDetails.size > 0) {
            const supplierFetchPromises = Array.from(supplierIdsToFetchDetails).map(sid =>
              getDoc(doc(db, FIREBASE_COLLECTIONS.FORNECEDORES, sid)).then(docSnap => {
                if (docSnap.exists()) {
                  supplierDataCacheRef.current.set(sid, { id: sid, ...docSnap.data() } as Fornecedor);
                }
              }).catch(err => console.error(`Failed to fetch supplier ${sid}:`, err))
            );
            await Promise.all(supplierFetchPromises);
          }

          setActiveQuotationDetails(prev => {
            if (!prev || prev.id !== selectedQuotationId) return prev; 
            const newOffersByProduct = new Map(prev.offersByProduct);
            newOffersByProduct.set(item.id, productOffersMap);
            return { ...prev, offersByProduct: newOffersByProduct };
          });
        });
        listenersToUnsubscribe.push(unsubProductOffers);
      }
      setIsLoadingSelectedQuotationData(false); 
    }, (error) => {
      console.error("Error listening to quotation document:", error);
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
  
  const tableProducts = useMemo((): EnhancedProductRow[] => {
    if (!activeQuotationDetails || !activeQuotationDetails.shoppingListItems || activeQuotationDetails.shoppingListItems.length === 0) {
        return [];
    }

    return activeQuotationDetails.shoppingListItems.map(item => {
      const productOffersMap = activeQuotationDetails.offersByProduct.get(item.id); 
      const allOffersForThisProduct: Offer[] = productOffersMap ? Array.from(productOffersMap.values()) : [];

      const preferredBrandsArray = item.preferredBrands ? item.preferredBrands.split(',').map(b => b.trim().toLowerCase()) : [];
      
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
      };
    });
  }, [activeQuotationDetails]);
  
  const isLoading = isLoadingAllQuotations || (isLoadingSelectedQuotationData && !!selectedQuotationId) ;
  const isQuotationPaused = activeQuotationDetails?.status === 'Pausada';

  return (
    <div className="w-full space-y-6">
      <Card className="shadow-lg rounded-xl overflow-hidden">
        <CardHeader className="p-4 md:p-6 border-b">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-3 text-2xl font-bold text-foreground">
              <FileText className="h-6 w-6 text-primary" />
              Painel de Cotação do Comprador
            </CardTitle>
            <div className="flex items-center gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {selectedDateForFilter ? format(selectedDateForFilter, "dd/MM/yyyy") : <span>Filtrar por Data</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <Calendar mode="single" selected={selectedDateForFilter} onSelect={handleDateChangeForFilter} initialFocus />
                    </PopoverContent>
                </Popover>
                {selectedDateForFilter && <Button variant="ghost" size="sm" onClick={() => handleDateChangeForFilter(undefined)}>Limpar Filtro</Button>}
                
                {timeLeft && selectedQuotationId && activeQuotationDetails && (
                  <Badge variant={isDeadlinePassed ? "destructive" : isQuotationPaused ? "outline" : "secondary"} className="text-base px-4 py-2 shadow-sm">
                    <Clock className="mr-2 h-5 w-5" /> {timeLeft}
                  </Badge>
                )}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t">
             <Button variant="outline" size="icon" onClick={() => navigateQuotation('prev')} disabled={filteredQuotationsForSelect.length < 2 || isLoading}>
               <ChevronLeft className="h-4 w-4" />
               <span className="sr-only">Cotação anterior</span>
             </Button>
             <Select value={selectedQuotationId} onValueChange={handleSelectQuotationFromDropdown} disabled={isLoading || filteredQuotationsForSelect.length === 0}>
                <SelectTrigger className="w-full md:min-w-[350px]">
                    <SelectValue placeholder={isLoadingAllQuotations ? "Carregando..." : "Selecione uma Cotação"} />
                </SelectTrigger>
                <SelectContent>
                    {filteredQuotationsForSelect.length === 0 && !isLoadingAllQuotations && <SelectItem value="no-quote" disabled>Nenhuma cotação para {selectedDateForFilter ? format(selectedDateForFilter, "dd/MM/yy") : "o filtro"}</SelectItem>}
                    {filteredQuotationsForSelect.map((quotation, index) => {
                       const quotationsOnSameDay = filteredQuotationsForSelect.filter(q => 
                          q.shoppingListDate && isSameDay(q.shoppingListDate.toDate(), quotation.shoppingListDate.toDate())
                       );
                       const isMultipleOnSameDay = quotationsOnSameDay.length > 1;
                       const quotationNumber = isMultipleOnSameDay 
                         ? quotationsOnSameDay.length - quotationsOnSameDay.findIndex(q => q.id === quotation.id) 
                         : 0;
                       
                       const quotationName = isMultipleOnSameDay
                         ? `Cotação ${quotationNumber} de ${format(quotation.shoppingListDate.toDate(), "dd/MM/yy")} (Status: ${quotation.status})`
                         : `Cotação de ${quotation.shoppingListDate ? format(quotation.shoppingListDate.toDate(), "dd/MM/yy") : "Data Inválida"} (Status: ${quotation.status})`;
                         
                       return (
                         <SelectItem key={quotation.id} value={quotation.id}>
                           {quotationName}
                         </SelectItem>
                       )
                    })}
                </SelectContent>
             </Select>
             <Button variant="outline" size="icon" onClick={() => navigateQuotation('next')} disabled={filteredQuotationsForSelect.length < 2 || isLoading}>
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Próxima cotação</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(isLoadingSelectedQuotationData && selectedQuotationId) ? (
            <div className="p-6 text-center text-muted-foreground flex items-center justify-center min-h-[200px]"> <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando detalhes... </div>
          ) : isQuotationPaused ? (
            <div className="p-6 text-center text-muted-foreground min-h-[200px] flex flex-col justify-center items-center">
                <PauseCircle className="h-10 w-10 text-amber-500 mb-4" />
                <h3 className="text-lg font-semibold">Cotação Pausada</h3>
                <p>Esta cotação está temporariamente pausada.</p>
            </div>
          ) : activeQuotationDetails && tableProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="sticky left-0 bg-muted/50 z-20 p-4 min-w-[300px] w-[300px] font-semibold text-sm align-top">
                      PRODUTO ({tableProducts.length})
                    </TableHead>
                    <TableHead className="p-4 min-w-[200px] font-semibold text-sm text-center align-top">
                      Melhor Preço<br />(Marcas Solicitadas)
                    </TableHead>
                    <TableHead className="p-4 font-semibold text-sm align-top">
                      OFERTAS DETALHADAS POR MARCA
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableProducts.map((productRow) => (
                    <TableRow key={productRow.productId} className="border-b">
                      <TableCell className="sticky left-0 bg-background z-10 font-medium p-4 whitespace-normal break-words align-top">
                        <div className="font-semibold text-base">{productRow.productName}</div>
                        <div className="text-sm text-muted-foreground mt-1">Pedido: {productRow.requestedQuantity} {productRow.unit}</div>
                        {productRow.preferredBrands && (
                          <div className="text-sm text-muted-foreground mt-1">
                            Marcas Pref.:{" "}
                            {productRow.preferredBrands.split(',').map((brand, i, arr) => (
                              <React.Fragment key={brand}>
                                <span className="text-primary font-medium">{brand.trim()}</span>
                                {i < arr.length - 1 && ', '}
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                         {productRow.notes && <div className="text-xs text-muted-foreground mt-2 italic">Obs: {productRow.notes}</div>}
                      </TableCell>
                      
                      <TableCell className="p-4 text-center align-top">
                        {productRow.bestPricePreferredBrandsDetails ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Avatar className="h-10 w-10">
                                    <Image src={productRow.bestPricePreferredBrandsDetails.supplierFotoUrl || 'https://placehold.co/40x40.png'} alt={productRow.bestPricePreferredBrandsDetails.supplierName} width={40} height={40} className="object-cover rounded-full" data-ai-hint={productRow.bestPricePreferredBrandsDetails.supplierFotoHint || 'logo company'} onError={(e) => { e.currentTarget.src = 'https://placehold.co/40x40.png'; }}/>
                                    <AvatarFallback>{productRow.bestPricePreferredBrandsDetails.supplierInitials}</AvatarFallback>
                                  </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-semibold">{productRow.bestPricePreferredBrandsDetails.supplierName}</p>
                                  <p className="text-xs">Marca: {productRow.bestPricePreferredBrandsDetails.brandName}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <p className="text-sm font-medium mt-1">{productRow.bestPricePreferredBrandsDetails.supplierName}</p>
                            <p className="text-base font-bold text-primary">{formatCurrency(productRow.bestPricePreferredBrandsDetails.price)}</p>
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </TableCell>

                      <TableCell className="p-4 align-top">
                        {productRow.offersByBrand.length > 0 ? (
                          <div className="flex flex-nowrap items-start gap-8 py-2 overflow-x-auto custom-scrollbar">
                            {productRow.offersByBrand.map((brandOffer, index) => (
                              <div key={`${productRow.productId}-${brandOffer.brandName}-${index}`} className="flex flex-col items-center text-center shrink-0 w-24">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Avatar className="h-10 w-10">
                                        <Image src={brandOffer.supplierFotoUrl || 'https://placehold.co/40x40.png'} alt={brandOffer.supplierName} width={40} height={40} className="object-cover rounded-full" data-ai-hint={brandOffer.supplierFotoHint || 'logo company'} onError={(e) => { e.currentTarget.src = 'https://placehold.co/40x40.png'; }}/>
                                        <AvatarFallback>{brandOffer.supplierInitials}</AvatarFallback>
                                      </Avatar>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="font-semibold">{brandOffer.supplierName}</p>
                                      <p className="text-xs">Marca: {brandOffer.brandName}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <p className="text-sm font-medium mt-1 truncate w-full" title={brandOffer.supplierName}>{brandOffer.supplierName}</p>
                                <p className="text-base font-bold text-primary">{formatCurrency(brandOffer.bestPriceForBrand)}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-muted-foreground h-full flex items-center">Nenhuma oferta para este item.</div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : selectedQuotationId ? (
             <div className="p-6 text-center text-muted-foreground min-h-[200px] flex flex-col justify-center items-center">
                {isLoadingSelectedQuotationData && <Loader2 className="mr-2 h-5 w-5 animate-spin mb-2" />}
                {isLoadingSelectedQuotationData && "Carregando dados da cotação..."}
                {!isLoadingSelectedQuotationData && activeQuotationDetails && activeQuotationDetails.shoppingListItems.length === 0 && `Nenhum item na lista para esta cotação.`}
                {!isLoadingSelectedQuotationData && !activeQuotationDetails && "Nenhum dado de cotação encontrado."}
             </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground min-h-[200px] flex justify-center items-center">
              <p>Selecione uma data ou uma cotação para visualizar os detalhes.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

