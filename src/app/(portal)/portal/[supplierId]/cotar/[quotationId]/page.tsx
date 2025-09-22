"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/config/firebase";
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp, collection, query, where, getDocs, Timestamp, addDoc, deleteDoc, updateDoc, arrayUnion } from "firebase/firestore";
import type { Quotation, Offer, ShoppingListItem, Fornecedor as SupplierType, UnitOfMeasure } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription as AlertPrimitiveDescription, AlertTitle } from "@/components/ui/alert";
import {
  Info,
  Settings2,
  PlusCircle,
  Save,
  ChevronLeft,
  Bell,
  Loader2,
  Building,
  User,
  Tag,
  Package,
  DollarSign,
  Hash,
  Scale,
  Clock,
  Trash2,
  Award,
  Briefcase, 
  Contact,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  TrendingDown,
  EyeOff,
  CheckCircle,
} from "lucide-react";
import { format, intervalToDuration } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sendOutbidNotification, sendCounterProposalReminder } from "@/actions/notificationActions";
import { closeQuotationAndItems } from "@/actions/quotationActions";
import { formatCurrency } from "@/lib/utils";


const QUOTATIONS_COLLECTION = "quotations";
const FORNECEDORES_COLLECTION = "fornecedores";
const SHOPPING_LIST_ITEMS_COLLECTION = "shopping_list_items";


const dayMap = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

interface OfferWithUI extends Offer {
  uiId: string; 
  isSuggestedBrand?: boolean;
}

interface BestOfferForBrandDisplay {
  brandName: string;
  pricePerUnit: number;
  supplierId: string;
  supplierName: string; 
  supplierInitials: string;
  supplierFotoUrl?: string;
  supplierFotoHint?: string;
  vendedor?: string; 
  cnpj?: string;
  packagingDescription?: string;
  unitsInPackaging?: number;
  totalPackagingPrice?: number;
  isSelf: boolean; 
  productUnit: UnitOfMeasure;
}

interface ProductToQuoteVM extends ShoppingListItem {
  supplierOffers: OfferWithUI[]; 
  bestOffersByBrand: BestOfferForBrandDisplay[];
  lowestPriceThisProductHas?: number | null;
  isDeliveryDayMismatch: boolean;
  counterProposalInfo?: {
      deadline: Date;
      winningBrand: string;
      myBrand: string; // The supplier's own brand that was outbid
  } | null;
  isLockedOut?: boolean;
  acknowledgedDeliveryMismatches?: string[]; // NEW FIELD
}


const abbreviateUnit = (unit: UnitOfMeasure | string): string => {
  switch (unit) {
    case "Kilograma(s)": return "Kg";
    case "Litro(s)": return "Lt";
    case "Unidade(s)": return "Unid.";
    case "Grama(s)": return "g";
    case "Mililitro(s)": return "ml";
    case "Caixa(s)": return "Cx.";
    case "Pacote(s)": return "Pct.";
    case "Dúzia(s)": return "Dz.";
    case "Peça(s)": return "Pç.";
    case "Metro(s)": return "m";
    case "Lata(s)": return "Lata"; 
    case "Garrafa(s)": return "Gf.";
    default:
      if (typeof unit === 'string' && unit.includes("(")) return unit.substring(0, unit.indexOf("(")).trim();
      return String(unit);
  }
};

const CountdownTimer: React.FC<{ deadline: Date; onEnd?: () => void }> = ({ deadline, onEnd }) => {
  const [timeLeft, setTimeLeft] = useState("Calculando...");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateTimer = useCallback(() => {
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    if (diff <= 0) {
      setTimeLeft("Encerrado");
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (onEnd) onEnd();
      return;
    }
    const duration = intervalToDuration({ start: now, end: deadline });
    const parts: string[] = [];
    if (duration.days && duration.days > 0) parts.push(`${duration.days}d`);
    if (duration.hours && duration.hours > 0) parts.push(`${duration.hours}h`);
    if (duration.minutes && duration.minutes > 0) parts.push(`${duration.minutes}m`);
    if (duration.seconds && duration.seconds > 0) parts.push(`${duration.seconds}s`);
    setTimeLeft(parts.join(' ') || "0s");
  }, [deadline, onEnd]);

  useEffect(() => {
    updateTimer();
    intervalRef.current = setInterval(updateTimer, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [updateTimer]);

  return <span>{timeLeft}</span>;
};

const isValidImageUrl = (url?: string): url is string => {
  return !!url && (url.startsWith('http') || url.startsWith('data:'));
};

export default function SellerQuotationPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const quotationId = params.quotationId as string;
  const supplierId = params.supplierId as string; // ID of the supplier currently viewing the portal

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [currentSupplierDetails, setCurrentSupplierDetails] = useState<SupplierType | null>(null);
  const [productsToQuote, setProductsToQuote] = useState<ProductToQuoteVM[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [unseenAlerts, setUnseenAlerts] = useState<string[]>([]);
  const [expandedProductIds, setExpandedProductIds] = useState<string[]>([]);

  
  const [timeLeft, setTimeLeft] = useState("Calculando...");
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
  
  const activeTimersRef = useRef(new Map<string, NodeJS.Timeout>());
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const brandInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const supplierDetailsCache = useRef(new Map<string, SupplierType>());
  const closingQuotationsRef = useRef(new Set<string>());

  const productsWithMyOffers = useMemo(() => {
    const productIds = new Set<string>();
    productsToQuote.forEach(product => {
        if (product.supplierOffers.some(offer => offer.id)) {
            productIds.add(product.id);
        }
    });
    return productIds;
  }, [productsToQuote]);

  const handleAutoCloseQuotation = useCallback(async (quotationId: string) => {
    if (closingQuotationsRef.current.has(quotationId)) {
        return;
    }
    console.log(`[SellerPortal] Deadline passed for quotation ${quotationId}. Triggering auto-close action from portal page.`);
    closingQuotationsRef.current.add(quotationId);

    const result = await closeQuotationAndItems(quotationId);
    if(result.success && (result.updatedItemsCount ?? 0) > 0) {
      toast({
        title: "Cotação Encerrada",
        description: "O prazo para esta cotação terminou. Não é mais possível enviar ou editar ofertas.",
      });
    } else if (!result.success) {
      console.error("Portal: Failed to auto-close quotation:", result.error);
    }
    closingQuotationsRef.current.delete(quotationId);
  }, [toast]);

  const handleAcknowledgeMismatch = async (productId: string) => {
    if (!supplierId) {
      toast({ title: "Erro", description: "ID do fornecedor ausente.", variant: "destructive" });
      return;
    }
    try {
      const itemRef = doc(db, SHOPPING_LIST_ITEMS_COLLECTION, productId);
      await updateDoc(itemRef, {
        acknowledgedDeliveryMismatches: arrayUnion(supplierId)
      });
      // Optimistically update local state
      setProductsToQuote(prevProducts =>
        prevProducts.map(p =>
          p.id === productId
            ? { ...p, acknowledgedDeliveryMismatches: [...(p.acknowledgedDeliveryMismatches || []), supplierId] }
            : p
        )
      );
      toast({ title: "Confirmação Salva", description: "Sua confirmação de entrega foi registrada." });
    } catch (error: any) {
      console.error("Error acknowledging delivery mismatch:", error);
      toast({ title: "Erro ao Salvar Confirmação", description: error.message, variant: "destructive" });
    }
  };


  // Main listener for the quotation document itself
  useEffect(() => {
    if (!quotationId) return;

    const quotationRef = doc(db, QUOTATIONS_COLLECTION, quotationId);
    const unsubscribe = onSnapshot(quotationRef, (docSnap) => {
      if (docSnap.exists()) {
        setQuotation({ id: docSnap.id, ...docSnap.data() } as Quotation);
      } else {
        toast({ title: "Cotação não encontrada.", variant: "destructive" });
        setQuotation(null);
      }
    });

    return () => unsubscribe();
  }, [quotationId, toast]);

  // Effect to load initial static data (supplier, products)
  useEffect(() => {
    if (!quotationId || !supplierId) {
        setIsLoading(false);
        toast({ title: "Erro", description: "ID da cotação ou do fornecedor ausente.", variant: "destructive" });
        return;
    }
    setIsLoading(true);

    const fetchInitialData = async () => {
      try {
        const quotationRef = doc(db, QUOTATIONS_COLLECTION, quotationId);
        const quotationSnap = await getDoc(quotationRef);
        if (!quotationSnap.exists()) throw new Error("Cotação não encontrada.");
        const fetchedQuotation = { id: quotationSnap.id, ...quotationSnap.data() } as Quotation;
        setQuotation(fetchedQuotation);

        const supplierRef = doc(db, FORNECEDORES_COLLECTION, supplierId);
        const supplierSnap = await getDoc(supplierRef);
        if (!supplierSnap.exists()) throw new Error("Fornecedor não encontrado.");
        const fetchedSupplier = { id: supplierSnap.id, ...supplierSnap.data() } as SupplierType;
        setCurrentSupplierDetails(fetchedSupplier); 
        supplierDetailsCache.current.set(supplierId, fetchedSupplier);
        
        const supplierDeliveryDays = fetchedSupplier.diasDeEntrega || [];

        const shoppingListItemsQuery = query(
          collection(db, SHOPPING_LIST_ITEMS_COLLECTION),
          where("quotationId", "==", quotationId)
        );
        
        const shoppingListSnapshot = await getDocs(shoppingListItemsQuery);
        
        const fetchedProducts = shoppingListSnapshot.docs.map(docSnap => {
          const itemData = docSnap.data() as ShoppingListItem;
          
          let isMismatch = false;
          if (itemData.hasSpecificDate && itemData.deliveryDate) {
            const deliveryDate = itemData.deliveryDate.toDate();
            const deliveryDay = dayMap[deliveryDate.getDay()];
            isMismatch = !supplierDeliveryDays.includes(deliveryDay);
          }
          
          return {
            ...itemData,
            id: docSnap.id,
            supplierOffers: [], 
            bestOffersByBrand: [],
            lowestPriceThisProductHas: null,
            isDeliveryDayMismatch: isMismatch,
            counterProposalInfo: null,
            isLockedOut: false,
          } as ProductToQuoteVM;
        }).sort((a,b) => a.name.localeCompare(b.name));
        
        setProductsToQuote(fetchedProducts);
        if (fetchedProducts.length > 0) {
            setExpandedProductIds([fetchedProducts[0].id]); 
        }

      } catch (error: any) {
        console.error("ERROR fetching initial data for seller quotation page:", error);
        toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, [quotationId, supplierId, toast]);

  useEffect(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (quotation && quotation.deadline) {
      const deadlineDate = quotation.deadline.toDate();

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
          if (quotation.id && quotation.status === 'Aberta') {
            handleAutoCloseQuotation(quotation.id);
          }
          return;
        }

        setIsDeadlinePassed(false);
        const duration = intervalToDuration({ start: now, end: deadlineDate });
        const parts: string[] = [];
        if (duration.days && duration.days > 0) parts.push(`${duration.days}d`);
        if (duration.hours && duration.hours > 0) parts.push(`${duration.hours}h`);
        if (duration.minutes && duration.minutes > 0) parts.push(`${duration.minutes}m`);
        if (duration.seconds && duration.seconds > 0) parts.push(`${duration.seconds}s`);
        
        setTimeLeft(parts.join(' ') || "Encerrando...");
      };

      updateTimer(); 
      countdownIntervalRef.current = setInterval(updateTimer, 1000);
    } else {
      setTimeLeft("Prazo não definido");
      setIsDeadlinePassed(false);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [quotation, handleAutoCloseQuotation]); 


  useEffect(() => {
    if (!quotationId || !supplierId || productsToQuote.length === 0 || !currentSupplierDetails || isLoading || !quotation) return ()=>{};

    const unsubscribers = productsToQuote.map(product => {
        const offersPath = `quotations/${quotationId}/products/${product.id}/offers`;
        const offersQuery = query(collection(db, offersPath));

                return onSnapshot(offersQuery, (offersSnapshot) => {
                    const processSnapshot = async () => {
                        const offersData = offersSnapshot.docs.map(doc => ({ ...doc.data() as Offer, id: doc.id, uiId: doc.id }));
        
                        const newSupplierIdsToFetch = new Set<string>();
                        offersData.forEach(offer => {
                            if (offer.supplierId && !supplierDetailsCache.current.has(offer.supplierId)) {
                                newSupplierIdsToFetch.add(offer.supplierId);
                            }
                        });
        
                        if (newSupplierIdsToFetch.size > 0) {
                            const fetchPromises = Array.from(newSupplierIdsToFetch).map(async (sid) => {
                                try {
                                    const supplierDoc = await getDoc(doc(db, FORNECEDORES_COLLECTION, sid));
                                    if (supplierDoc.exists()) {
                                        supplierDetailsCache.current.set(sid, { ...supplierDoc.data(), id: sid } as SupplierType);
                                    }
                                } catch (err) {
                                    console.error(`Error fetching supplier details for ID ${sid}:`, err);
                                }
                            });
                            await Promise.all(fetchPromises);
                        }
                        
                        const offersGroupedByBrand = new Map<string, Offer[]>();
                        offersData.forEach(offer => {
                            if(offer.pricePerUnit > 0) {
                                if (!offersGroupedByBrand.has(offer.brandOffered)) {
                                    offersGroupedByBrand.set(offer.brandOffered, []);
                                }
                                offersGroupedByBrand.get(offer.brandOffered)!.push(offer);
                            }
                        });
        
                        const brandDisplays: BestOfferForBrandDisplay[] = [];
                        offersGroupedByBrand.forEach((offers, brandName) => {
                            if (offers.length === 0) return;
                            const bestOffer = offers.reduce((prev, curr) => prev.pricePerUnit < curr.pricePerUnit ? prev : curr);
                            const supplierDetails = supplierDetailsCache.current.get(bestOffer.supplierId);
                            if (supplierDetails) {
                                brandDisplays.push({
                                  brandName,
                                  pricePerUnit: bestOffer.pricePerUnit,
                                  supplierId: bestOffer.supplierId,
                                  supplierName: supplierDetails.empresa,
                                  supplierInitials: supplierDetails.empresa.substring(0, 2).toUpperCase(),
                                  supplierFotoUrl: supplierDetails.fotoUrl,
                                  supplierFotoHint: supplierDetails.fotoHint,
                                  vendedor: supplierDetails.vendedor,
                                  cnpj: supplierDetails.cnpj,
                                  packagingDescription: bestOffer.packagingDescription,
                                  unitsInPackaging: bestOffer.unitsInPackaging,
                                  totalPackagingPrice: bestOffer.totalPackagingPrice,
                                  isSelf: bestOffer.supplierId === supplierId,
                                  productUnit: product.unit,
                                });
                            }
                        });
                        brandDisplays.sort((a, b) => a.pricePerUnit - b.pricePerUnit || a.brandName.localeCompare(b.brandName));
        
                        const lowestPriceOverall = brandDisplays.length > 0 ? brandDisplays[0].pricePerUnit : null;
                        const myOffers = offersData.filter(o => o.supplierId === supplierId).map(o => ({...o, uiId: o.id}));
                        
                        let counterProposalInfo: ProductToQuoteVM['counterProposalInfo'] = null;
                        let isLockedOut = false;
                        const myOffersWithPrice = myOffers.filter(o => o.pricePerUnit > 0);
        
                        if (myOffersWithPrice.length > 0) {
                            const myBestOffer = myOffersWithPrice.reduce((prev, curr) => (prev.pricePerUnit < curr.pricePerUnit ? prev : curr));
                            const myBestPrice = myBestOffer.pricePerUnit;
        
                            if(lowestPriceOverall && myBestPrice > lowestPriceOverall) {
                                const outbidOffer = offersData
                                    .filter(o => o.supplierId !== supplierId && o.pricePerUnit === lowestPriceOverall && o.updatedAt instanceof Timestamp)
                                    .sort((a, b) => (b.updatedAt as Timestamp).toMillis() - (a.updatedAt as Timestamp).toMillis())[0];
                                
                                const counterProposalMins = quotation.counterProposalTimeInMinutes ?? 15;
                                
                                if (outbidOffer && outbidOffer.updatedAt instanceof Timestamp) {
                                    const deadline = new Date(outbidOffer.updatedAt.toDate().getTime() + counterProposalMins * 60000);
        
                                    if (new Date() < deadline) {
                                        counterProposalInfo = { 
                                            deadline, 
                                            winningBrand: outbidOffer.brandOffered,
                                            myBrand: myBestOffer.brandOffered,
                                        };
                                    } else {
                                        isLockedOut = true;
                                    }
                                }
                            }
                        }
                        
                        setProductsToQuote(currentProducts =>
                            currentProducts.map(p => {
                                if (p.id === product.id) {
                                  const existingNewOffers = p.supplierOffers.filter(o => !o.id);
                                  const updatedOffers = [...myOffers, ...existingNewOffers].sort((a,b) => (a.brandOffered || '').localeCompare(b.brandOffered || ''));
                                  return { ...p, supplierOffers: updatedOffers, bestOffersByBrand: brandDisplays, lowestPriceThisProductHas: lowestPriceOverall, counterProposalInfo, isLockedOut };
                                }
                                return p;
                            })
                        );
                    };
        
                    processSnapshot();
                });    });

    return () => {
        unsubscribers.forEach(unsub => unsub());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId, supplierId, currentSupplierDetails, toast, isLoading, quotation]);
  
  // Effect for component unmount cleanup - only runs once
  useEffect(() => {
    // This is the ref to be used in the cleanup function.
    // It's a snapshot of the ref when the effect was created.
    const timers = activeTimersRef.current;
    return () => {
      console.log("[Reminder] Component unmounting. Clearing all active timers.");
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect to schedule and manage counter-proposal reminders
  useEffect(() => {
    if (!quotation || !currentSupplierDetails || productsToQuote.length === 0) {
      return;
    }

    const requiredReminders = new Set<string>();

    productsToQuote.forEach(product => {
      const { counterProposalInfo } = product;
      if (
        counterProposalInfo &&
        quotation.counterProposalTimeInMinutes &&
        quotation.counterProposalReminderPercentage &&
        quotation.counterProposalReminderPercentage > 0 &&
        new Date() < counterProposalInfo.deadline
      ) {
        // The key must be unique for each combination of product and the supplier's brand that was outbid.
        const reminderKey = `${product.id}-${counterProposalInfo.myBrand}`;
        requiredReminders.add(reminderKey);
      }
    });

    // Clean up obsolete timers
    const currentTimers = activeTimersRef.current;
    currentTimers.forEach((timerId, reminderKey) => {
      if (!requiredReminders.has(reminderKey)) {
        console.log(`[Reminder] Clearing obsolete reminder: ${reminderKey}`);
        clearTimeout(timerId);
        currentTimers.delete(reminderKey);
      }
    });

    // Set new timers
    requiredReminders.forEach(reminderKey => {
      if (!currentTimers.has(reminderKey)) {
        const [productId, myBrand] = reminderKey.split(/-(.*)/s);
        const product = productsToQuote.find(p => p.id === productId && p.counterProposalInfo?.myBrand === myBrand);

        if (product && product.counterProposalInfo) {
          const { deadline } = product.counterProposalInfo;
          const totalDurationMs = quotation.counterProposalTimeInMinutes! * 60 * 1000;
          const reminderPercentage = quotation.counterProposalReminderPercentage!;
          
          const remindBeforeEndMs = totalDurationMs * (reminderPercentage / 100);
          const timeoutDelayMs = deadline.getTime() - remindBeforeEndMs - Date.now();
          const minutesLeftForMessage = Math.round(remindBeforeEndMs / 60000);

          if (timeoutDelayMs > 0 && minutesLeftForMessage > 0) {
            console.log(`[Reminder] Scheduling new reminder for ${product.name} (${myBrand}) in ${timeoutDelayMs / 1000}s.`);
            
            const timerId = setTimeout(() => {
              console.log(`[Reminder] Sending reminder for ${product.name} (${myBrand}).`);
              if (currentSupplierDetails && myBrand && quotation.userId) {
                  sendCounterProposalReminder(
                    currentSupplierDetails,
                    product.name,
                    myBrand,
                    minutesLeftForMessage,
                    quotation.userId
                  );
              }
              currentTimers.delete(reminderKey);
            }, timeoutDelayMs);

            currentTimers.set(reminderKey, timerId);
          }
        }
      }
    });
  }, [productsToQuote, quotation, currentSupplierDetails]);

  const toggleProductExpansion = (productId: string) => {
    setExpandedProductIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [productId] 
    );
  };

  const handleOfferChange = (productId: string, offerUiId: string, field: keyof OfferWithUI, value: string | number) => {
    setProductsToQuote(prevProducts =>
      prevProducts.map(p =>
        p.id === productId
          ? {
              ...p,
              supplierOffers: p.supplierOffers.map((offer) =>
                offer.uiId === offerUiId ? { ...offer, [field]: value, updatedAt: serverTimestamp() as Timestamp } : offer
              ),
            }
          : p
      )
    );
  };

  const addOfferField = (productId: string, brandToPreFill?: string, isSuggested?: boolean) => {
    if (!currentSupplierDetails) {
        toast({title: "Erro", description: "Dados do fornecedor não carregados.", variant: "destructive"});
        return;
    }
    if (!expandedProductIds.includes(productId)) {
      setExpandedProductIds(prev => [...prev, productId]);
    }

    const newOfferUiId = Date.now().toString() + Math.random().toString(36).substring(2,7); 

    setProductsToQuote(prevProducts =>
      prevProducts.map(p => {
        if (p.id === productId) {
            const newOffer: OfferWithUI = {
                uiId: newOfferUiId, 
                supplierId: supplierId,
                supplierName: currentSupplierDetails.empresa || "N/A",
                supplierInitials: currentSupplierDetails.empresa.substring(0, 2).toUpperCase() || "XX",
                brandOffered: brandToPreFill || "",
                packagingDescription: "",
                unitsInPackaging: 0,
                totalPackagingPrice: 0,
                pricePerUnit: 0, 
                updatedAt: serverTimestamp() as Timestamp, 
                productId: productId,
                isSuggestedBrand: isSuggested || false,
            };
            const updatedProduct = {
                ...p,
                supplierOffers: [...p.supplierOffers, newOffer],
            };
             setTimeout(() => { 
                const brandInputRef = brandInputRefs.current[`${productId}_${newOfferUiId}`];
                brandInputRef?.focus();
            }, 0);
            return updatedProduct;
        }
        return p;
      })
    );
  };
  
  const removeOfferField = async (productId: string, offerToRemove: OfferWithUI) => {
    if (offerToRemove.id) { 
        setIsSaving(prev => ({ ...prev, [`${productId}_${offerToRemove.uiId}`]: true }));
        try {
            const offerRef = doc(db, `quotations/${quotationId}/products/${productId}/offers/${offerToRemove.id}`);
            await deleteDoc(offerRef);
            toast({ title: "Oferta Removida", description: "A oferta foi removida do banco de dados." });
        } catch (error: any) {
            toast({ title: "Erro ao Remover", description: error.message, variant: "destructive" });
            setIsSaving(prev => ({ ...prev, [`${productId}_${offerToRemove.uiId}`]: false }));
            return; 
        } finally {
             setIsSaving(prev => ({ ...prev, [`${productId}_${offerToRemove.uiId}`]: false }));
        }
    }
    setProductsToQuote(prevProducts =>
      prevProducts.map(p =>
        p.id === productId
          ? { ...p, supplierOffers: p.supplierOffers.filter(offer => offer.uiId !== offerToRemove.uiId) }
          : p
      )
    );
  };

  const handleSuggestedBrandClick = (productId: string, brandName: string) => {
    const product = productsToQuote.find(p => p.id === productId);
    if (!product) return;

    const unsavedOfferIndex = product.supplierOffers.findIndex(o => !o.id);

    if (unsavedOfferIndex !== -1) {
        // There is an unsaved offer, so update it.
        handleOfferChange(productId, product.supplierOffers[unsavedOfferIndex].uiId, 'brandOffered', brandName);
    } else {
        // There are no unsaved offers, so add a new one.
        addOfferField(productId, brandName, true);
    }
  };

  const handleOtherBrandClick = (productId: string) => {
    const product = productsToQuote.find(p => p.id === productId);
    if (!product) return;

    const unsavedOfferIndex = product.supplierOffers.findIndex(o => !o.id);

    if (unsavedOfferIndex === -1) {
        // Only add a new field if there are no unsaved offers
        addOfferField(productId, '', false);
    }
  };

  const calculatePricePerUnit = (offer: OfferWithUI | Partial<OfferWithUI>): number | null => {
    const units = Number(offer.unitsInPackaging);
    const price = Number(offer.totalPackagingPrice);
    if (!isNaN(units) && !isNaN(price) && units > 0 && price > 0) {
      return price / units;
    }
    return null;
  };

  const handleSaveProductOffer = async (productId: string, offerUiId: string) => {
    if (!currentSupplierDetails || !quotation || !quotation.userId) {
        toast({title: "Erro Interno", description: "Dados do fornecedor, cotação ou ID do comprador ausentes.", variant: "destructive"});
        return;
    }
    const product = productsToQuote.find(p => p.id === productId);
    if (!product) return;

    const offerToSaveIndex = product.supplierOffers.findIndex(o => o.uiId === offerUiId);
    if (offerToSaveIndex === -1) {
        toast({title: "Erro", description: "Oferta não encontrada para salvar.", variant: "destructive"});
        return;
    }
    const offerData = product.supplierOffers[offerToSaveIndex]; 

    const unitsInPackaging = Number(offerData.unitsInPackaging);
    const totalPackagingPrice = Number(offerData.totalPackagingPrice);

    if (isNaN(unitsInPackaging) || unitsInPackaging <= 0 || isNaN(totalPackagingPrice) || totalPackagingPrice <= 0 || !offerData.brandOffered.trim() || !offerData.packagingDescription.trim()) {
      toast({title: "Dados Inválidos", description: "Preencha todos os campos da oferta corretamente (Marca, Embalagem, Unidades > 0, Preço > 0).", variant: "destructive", duration: 7e3});
      return;
    }

    const pricePerUnit = totalPackagingPrice / unitsInPackaging;

    const bestCompetitorOffer = product.bestOffersByBrand.find(o => o.supplierId !== supplierId);

    if (bestCompetitorOffer && pricePerUnit < bestCompetitorOffer.pricePerUnit && pricePerUnit > bestCompetitorOffer.pricePerUnit * 0.99) {
        toast({
            title: "Oferta Inválida",
            description: `Sua oferta deve ser pelo menos 1% menor que a melhor oferta atual de ${formatCurrency(bestCompetitorOffer.pricePerUnit)}. O valor mínimo para cobrir esta oferta é de ${formatCurrency(bestCompetitorOffer.pricePerUnit * 0.99)}. `,
            variant: "destructive",
        });
        return;
    }

    const isDuplicatePrice = product.bestOffersByBrand.some(
        (offer) => offer.pricePerUnit === pricePerUnit && offer.supplierId !== supplierId
    );

    if (isDuplicatePrice) {
        toast({
            title: "Preço Duplicado",
            description: "Este preço já foi ofertado por outro fornecedor. Por favor, insira um valor diferente.",
            variant: "destructive",
        });
        return;
    }

    const brandName = offerData.brandOffered.trim();

    const previousBestOffer = product.bestOffersByBrand.length > 0 ? product.bestOffersByBrand[0] : null;

    if (previousBestOffer && !previousBestOffer.isSelf && pricePerUnit < previousBestOffer.pricePerUnit) {
      console.log(`[Action Trigger] Condition met to notify for product ${product.name}. My price ${pricePerUnit} is less than ${previousBestOffer.pricePerUnit}.`);
      let outbidSupplierDetails = supplierDetailsCache.current.get(previousBestOffer.supplierId);
      
      if (!outbidSupplierDetails) {
          try {
              const docSnap = await getDoc(doc(db, FORNECEDORES_COLLECTION, previousBestOffer.supplierId));
              if (docSnap.exists()) {
                  outbidSupplierDetails = { id: docSnap.id, ...docSnap.data() } as SupplierType;
                  supplierDetailsCache.current.set(previousBestOffer.supplierId, outbidSupplierDetails);
              }
          } catch(err) {
              console.error(`[Action Trigger] Failed to fetch outbid supplier details for ID ${previousBestOffer.supplierId}`, err);
          }
      }
      
      if (outbidSupplierDetails) {
        const supplierInfo = {
            whatsapp: outbidSupplierDetails.whatsapp,
            empresa: outbidSupplierDetails.empresa,
        };
        sendOutbidNotification(
          supplierInfo,
          {
            productName: product.name,
            brandName: previousBestOffer.brandName,
            newBestPriceFormatted: formatCurrency(pricePerUnit, false),
            unitAbbreviated: abbreviateUnit(product.unit),
            winningSupplierName: currentSupplierDetails.empresa,
            counterProposalTimeInMinutes: quotation.counterProposalTimeInMinutes ?? 15,
          },
          quotation.userId
        ).then(result => {
           if (!result.success) {
               toast({
                   title: "Falha na Notificação",
                   description: `Não foi possível notificar o concorrente sobre a contraproposta. Erro: ${result.error}`,
                   variant: "destructive"
               });
           }
        });

      } else {
        console.warn(`[Action Trigger] Could not find details for outbid supplier ID: ${previousBestOffer.supplierId}`);
      }
    }

    const offerPayload: Omit<Offer, 'id'> = { 
      supplierId: currentSupplierDetails.id, 
      supplierName: currentSupplierDetails.empresa, 
      supplierInitials: currentSupplierDetails.empresa.substring(0, 2).toUpperCase(), 
      brandOffered: offerData.brandOffered,
      packagingDescription: offerData.packagingDescription,
      unitsInPackaging,
      totalPackagingPrice,
      pricePerUnit,
      updatedAt: serverTimestamp() as Timestamp, 
      productId: productId, 
    };
    
    const savingKey = `${productId}_${offerUiId}`;
    setIsSaving(prev => ({ ...prev, [savingKey]: true }));
    try {
      if (offerData.id) { 
        const offerRef = doc(db, `quotations/${quotationId}/products/${productId}/offers/${offerData.id}`);
        await updateDoc(offerRef, offerPayload); 
        toast({ title: "Oferta Atualizada!", description: `Sua oferta para ${product.name} (${offerData.brandOffered}) foi atualizada.` });
      } else { 
        const offerCollectionRef = collection(db, `quotations/${quotationId}/products/${productId}/offers`);
        const newOfferDocRef = await addDoc(offerCollectionRef, offerPayload);
        setProductsToQuote(prevProducts => prevProducts.map(p => p.id === productId ? {
            ...p,
            supplierOffers: p.supplierOffers.map(o => o.uiId === offerUiId ? {...o, id: newOfferDocRef.id } : o)
        } : p));
        toast({ title: "Oferta Salva!", description: `Sua oferta para ${product.name} (${offerData.brandOffered}) foi salva.` });
      }
      
      setUnseenAlerts(prev => prev.filter(alertId => alertId !== productId)); 
    } catch (error: any) {
      toast({ title: "Erro ao Salvar Oferta", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(prev => ({ ...prev, [savingKey]: false }));
    }
  };
  
  const handleBeatOfferClick = (productId: string, offerUiId: string, discountPercentage: number) => {
    const product = productsToQuote.find((p) => p.id === productId);
    const offer = product?.supplierOffers.find((o) => o.uiId === offerUiId);

    if (!product || !offer) {
      return;
    }

    const bestOverallPrice = product.lowestPriceThisProductHas;

    if (!bestOverallPrice) {
      toast({
        title: "Sem oferta para cobrir",
        description: "Nenhum concorrente ofertou para este produto ainda.",
      });
      return;
    }

    const units = Number(offer.unitsInPackaging);
    if (isNaN(units) || units <= 0) {
      toast({
        title: "Unidades necessárias",
        description:
          "Primeiro, preencha o campo 'Total Un na Emb.' para calcular o preço.",
        variant: "destructive",
      });
      return;
    }
    
    const targetPricePerUnit = bestOverallPrice * (1 - discountPercentage / 100.0);
    const newTotalPackagingPrice = targetPricePerUnit * units;

    handleOfferChange(
      productId,
      offerUiId,
      'totalPackagingPrice',
      parseFloat(newTotalPackagingPrice.toFixed(6))
    );
     toast({
        title: "Preço Ajustado",
        description: `Novo preço calculado para um desconto de ${discountPercentage}%. Salve a oferta para confirmar.`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Carregando cotação...</p>
      </div>
    );
  }
  
  if (!quotation || !currentSupplierDetails) {
    return (
      <div className="p-8 text-center text-destructive">
        Cotação ou fornecedor não encontrado. Verifique os IDs.
      </div>
    );
  }

  if (quotation.status === 'Pausada') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-center p-4">
        <Clock className="h-16 w-16 text-amber-500 mb-4" />
        <h1 className="text-3xl font-bold text-foreground">Cotação Pausada</h1>
        <p className="text-lg text-muted-foreground mt-2">O comprador pausou temporariamente esta cotação.</p>
        <p className="text-muted-foreground">Novas ofertas não podem ser enviadas no momento. Por favor, aguarde.</p>
        <Button variant="outline" onClick={() => router.push(`/portal/${supplierId}`)} className="mt-8">
            <ChevronLeft className="mr-2 h-4 w-4"/> Voltar ao Portal
        </Button>
      </div>
    );
  }

  const isQuotationEnded = isDeadlinePassed || quotation.status === 'Fechada' || quotation.status === 'Concluída';
 
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <header className="space-y-4 pb-6 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Button variant="outline" onClick={() => router.push(`/portal/${supplierId}`)} className="w-full sm:w-auto">
                <ChevronLeft className="mr-2 h-4 w-4"/> Voltar ao Portal
            </Button>
            {unseenAlerts.length > 0 && (
                <Badge variant="destructive" className="flex items-center gap-1.5 text-sm p-2 animate-pulse order-first sm:order-none">
                    <Bell className="h-4 w-4"/> {unseenAlerts.length} Alerta(s) de Preço!
                </Badge>
            )}
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-x-6 gap-y-3">
          <div className="flex-grow">
            <h1 className="text-2xl md:text-3xl font-bold text-primary">Responder Cotação</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Fornecedor: <span className="font-semibold">{currentSupplierDetails.empresa}</span></p>
          </div>
          <div className={`text-center md:text-right p-3 rounded-lg shadow-sm border min-w-[240px] ${isQuotationEnded ? 'bg-destructive/10 border-destructive text-destructive' : 'bg-card border-border'}`}>
              <p className={`text-xs font-medium ${isQuotationEnded ? 'text-destructive/80' : 'text-muted-foreground'} uppercase`}>
                  {isQuotationEnded ? 'Prazo Encerrado' : 'Tempo Restante'}
              </p>
              {!isQuotationEnded && (
                  <div className={`text-xl md:text-2xl font-bold ${isQuotationEnded ? 'text-destructive' : 'text-primary'} flex items-center justify-center md:justify-end gap-1.5 mt-0.5`}>
                      <Clock className={`h-5 w-5 md:h-6 md:w-6 ${isQuotationEnded ? 'text-destructive' : 'text-primary'}`} />
                      <span>{timeLeft}</span>
                  </div>
              )}
              {isQuotationEnded && timeLeft === 'Prazo Encerrado' && (
                  <p className="text-xl md:text-2xl font-bold text-destructive mt-0.5">{timeLeft}</p>
              )}
              <p className={`text-xs ${isQuotationEnded ? 'text-destructive/70' : 'text-muted-foreground'} mt-0.5`}>
                  (Prazo Final: {quotation.deadline ? format(quotation.deadline.toDate(), "dd/MM/yyyy HH:mm", {locale: ptBR}) : 'N/A'})
              </p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2"><Contact className="h-5 w-5 text-primary"/>Seus Dados (Fornecedor)</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <Image src={isValidImageUrl(currentSupplierDetails.fotoUrl) ? currentSupplierDetails.fotoUrl : 'https://placehold.co/64x64.png'} alt={currentSupplierDetails.empresa} width={64} height={64} className="object-cover w-full h-full rounded-full" data-ai-hint={currentSupplierDetails.fotoHint || 'logo company'} />
                        <AvatarFallback className="bg-muted text-xl">{currentSupplierDetails.empresa.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{currentSupplierDetails.vendedor}</p>
                        <p className="text-sm text-muted-foreground">{currentSupplierDetails.empresa}</p>
                        <p className="text-xs text-muted-foreground">CNPJ: {currentSupplierDetails.cnpj}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" />Detalhes da Cotação</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-2">
                <div className="text-sm flex items-center gap-2">
                    <span className="font-medium">Status:</span>
                    <Badge variant={quotation.status === 'Aberta' ? 'default' : 'secondary'}>{quotation.status}</Badge>
                </div>
                <div className="text-sm"><span className="font-medium">Data da Lista:</span> {quotation.shoppingListDate ? format(quotation.shoppingListDate.toDate(), "dd/MM/yyyy", { locale: ptBR }) : 'N/A'}</div>
                <p className="text-sm"><span className="font-medium">Criada em:</span> {quotation.createdAt && 'toDate' in quotation.createdAt ? format(quotation.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}</p>
            </CardContent>
        </Card>
      </section>
      
      <section className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">Produtos para Cotação ({productsToQuote.length})</h2>
          {productsToQuote.length === 0 && !isLoading ? (
              <Card><CardContent className="p-6 text-center"><p className="text-muted-foreground">Nenhum item encontrado nesta cotação ou a lista de compras associada está vazia.</p><p className="text-xs text-muted-foreground mt-2">Verifique se a data da lista de compras da cotação ({quotation.shoppingListDate ? format(quotation.shoppingListDate.toDate(), "dd/MM/yyyy", { locale: ptBR }) : 'N/A'}) possui itens cadastrados.</p></CardContent></Card>
          ) : productsToQuote.map((product, index) => {
              const hasUnseenAlert = unseenAlerts.includes(product.id);
              const isExpanded = expandedProductIds.includes(product.id);
              const isDeliveryMismatch = product.hasSpecificDate && product.isDeliveryDayMismatch;
              const hasMyOffers = productsWithMyOffers.has(product.id);
              const isLockedOut = !!product.isLockedOut;

              // New logic for pulsating border on main product card
              const isMyOfferWinning = product.supplierOffers.some(offer => offer.supplierId === supplierId && offer.pricePerUnit === product.lowestPriceThisProductHas);
              const isMyOfferLosing = product.supplierOffers.some(offer => offer.supplierId === supplierId) && !isMyOfferWinning;

              return (
                <Card key={product.id} className={`border-2 ${
                    hasUnseenAlert ? 'border-destructive shadow-lg' :
                    !hasMyOffers ? 'border-muted-foreground/20' : 'border-transparent'
                }
                    ${isMyOfferWinning ? 'animate-pulse-glow-green' : ''}
                    ${isMyOfferLosing ? 'animate-pulse-glow-red' : ''}
                  `}>                  <CardHeader className="bg-muted/30 p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleProductExpansion(product.id)}>
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                          <div className="flex items-center gap-3 flex-grow">

                              <div>
                                  <h3 className="text-lg font-semibold">{product.name}</h3>
                                  <p className="text-sm text-muted-foreground">
                                    Pedido: {product.quantity} {abbreviateUnit(product.unit)} para {product.hasSpecificDate && product.deliveryDate ? format(product.deliveryDate.toDate(), "dd/MM/yyyy", { locale: ptBR }) : <span className="font-medium text-accent">entregar na próxima entrega da sua grade</span>}
                                  </p>
                              </div>
                          </div>
                          {!hasMyOffers && isExpanded && (
                              <div className="flex items-center gap-2 p-3 rounded-md bg-accent/10 border border-accent/20 text-accent">
                                  <EyeOff className="h-5 w-5" />
                                  <div className="text-sm">
                                      <p className="font-semibold">Preços Ocultos</p>
                                      <p className="text-xs">Faça uma oferta para ver os lances.</p>
                                  </div>
                              </div>
                          )}
                          {hasMyOffers && product.bestOffersByBrand && product.bestOffersByBrand.length > 0 && (
                            <div className="flex flex-row flex-wrap gap-2 p-1">
                                {product.bestOffersByBrand.map(offer => {
                                    let variantClasses = "border-muted-foreground/20";
                                    let textPriceClass = "text-foreground";
                                    const isLowestOverall = product.lowestPriceThisProductHas !== null && offer.pricePerUnit === product.lowestPriceThisProductHas;
                                    
                                    if(isLowestOverall) {
                                      variantClasses = "border-green-500";
                                      textPriceClass = "text-green-600 dark:text-green-400";
                                    } else if(offer.isSelf) {
                                      variantClasses = "border-primary";
                                      textPriceClass = "text-primary";
                                    }

                                    return (
                                        <div key={offer.brandName + offer.supplierId} className={`flex items-center justify-between p-2 rounded-md bg-muted/20 border-l-4 min-w-[200px] flex-grow ${variantClasses}`}>
                                            <div className="flex items-center gap-3">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Avatar className="h-8 w-8 shrink-0 cursor-pointer">
                                                              <Image src={isValidImageUrl(offer.supplierFotoUrl) ? offer.supplierFotoUrl : 'https://placehold.co/40x40.png'} alt={offer.supplierName || 'Fornecedor'} width={40} height={40} className="object-cover w-full h-full rounded-full" data-ai-hint={offer.supplierFotoHint || 'logo company'} />
                                                              <AvatarFallback className="text-xs bg-muted">{offer.supplierInitials}</AvatarFallback>
                                                            </Avatar>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="bg-background border text-foreground shadow-lg rounded-md text-xs p-2">
                                                          <p className="font-semibold">{offer.vendedor}</p>
                                                          <p>{offer.supplierName}</p>
                                                          <p className="text-muted-foreground">CNPJ: {offer.cnpj}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                                <div>
                                                    <p className="text-sm font-semibold" title={offer.brandName}>{offer.brandName}</p>
                                                    <p className="text-xs text-muted-foreground">por {offer.supplierName}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-base font-bold ${textPriceClass}`}>{formatCurrency(offer.pricePerUnit)} / {abbreviateUnit(offer.productUnit)}</p>
                                                <div className="mt-1">
                                                  {isLowestOverall && <Badge variant={offer.isSelf ? "default" : "outline"} className={`text-xs ${offer.isSelf ? 'bg-green-600 text-white' : 'border-green-600 text-green-700'}`}>Melhor Preço</Badge>}
                                                  {!isLowestOverall && offer.isSelf && <Badge variant="default" className="text-xs">Sua Oferta</Badge>}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                          )}
                          <div className="sm:ml-auto">
                            {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                          </div>
                      </div>
                  </CardHeader>
                  {isExpanded && (
                      <div className="relative">
                          {isDeliveryMismatch && !product.acknowledgedDeliveryMismatches?.includes(supplierId) && (
                              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-4 text-center rounded-b-lg">
                                 <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
                                  <p className="font-semibold text-destructive-foreground">A entrega em {product.deliveryDate ? format(product.deliveryDate.toDate(), "eeee, dd/MM", { locale: ptBR }) : ''} está fora da sua grade.</p>
                                  <p className="text-sm text-muted-foreground mb-4">Sua grade de entrega: {currentSupplierDetails?.diasDeEntrega?.join(', ') || 'Nenhuma'}</p>
                                  <Button onClick={() => handleAcknowledgeMismatch(product.id)}>Cotar mesmo assim (Confirmo que posso entregar)</Button>
                              </div>
                          )}
                           <CardContent className={`p-4 space-y-4 ${isDeliveryMismatch && !product.acknowledgedDeliveryMismatches?.includes(supplierId) ? 'opacity-40 pointer-events-none' : ''}`}>
                               {isLockedOut && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>Prazo de Contraproposta Expirado</AlertTitle>
                                        <AlertPrimitiveDescription>
                                            Seu tempo para cobrir a oferta concorrente neste item terminou. Não é mais possível enviar ou editar propostas para este produto.
                                        </AlertPrimitiveDescription>
                                    </Alert>
                               )}
                               {product.counterProposalInfo && (
                                   <Alert variant="destructive" className="my-2 animate-pulse">
                                      <AlertTriangle className="h-4 w-4"/>
                                      <AlertTitle>Contraproposta Urgente!</AlertTitle>
                                      <AlertPrimitiveDescription className="flex items-center gap-2">
                                                                                    Sua oferta para &quot;{product.counterProposalInfo.myBrand}&quot; foi superada! Você tem                                           <strong className="flex items-center gap-1.5 text-base">
                                            <Clock className="h-4 w-4"/>
                                            <CountdownTimer deadline={product.counterProposalInfo.deadline} />
                                          </strong>
                                           para cobrir a oferta da marca &quot;{product.counterProposalInfo.winningBrand}&quot;.
                                      </AlertPrimitiveDescription>
                                   </Alert>
                               )}

                               <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-2 text-sm">
                                  {product.preferredBrands && product.preferredBrands.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-medium text-muted-foreground mr-1">Marcas Sugeridas:</span>
                                      {product.preferredBrands.split(',').map(brand => (
                                          <Badge key={brand.trim()} variant="outline" onClick={() => !isLockedOut && handleSuggestedBrandClick(product.id, brand.trim())} className={isLockedOut ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted hover:border-primary/50'}>{brand.trim()}</Badge>
                                      ))}
                                    </div>
                                  )}
                                  <Badge variant="outline" onClick={() => !isLockedOut && handleOtherBrandClick(product.id)} className={`border-primary/70 text-primary/90 ${isLockedOut ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted hover:border-primary/50'}`}>
                                    <PlusCircle className="mr-1.5 h-3 w-3" /> Outra Marca
                                  </Badge>
                                  {product.notes && <p className="text-muted-foreground mt-2 sm:mt-0"><span className="font-medium">Obs. Comprador:</span> {product.notes}</p>}
                               </div>


                               
                               {product.supplierOffers.map((offer, offerIndex) => {
                                 const pricePerUnit = calculatePricePerUnit(offer);
                                 let pricePerUnitClasses = "bg-muted";
                                 const bestCompetitorOfferOverall = product.bestOffersByBrand.find(b => !b.isSelf);
                                 const isMyOfferOutbid = bestCompetitorOfferOverall && pricePerUnit && pricePerUnit > bestCompetitorOfferOverall.pricePerUnit;
                                 
                                 if (hasMyOffers && pricePerUnit !== null && bestCompetitorOfferOverall) {
                                    if(pricePerUnit <= bestCompetitorOfferOverall.pricePerUnit) {
                                      pricePerUnitClasses = "bg-green-500/10 border-green-500/40 text-green-700 font-semibold";
                                    } else if (pricePerUnit > bestCompetitorOfferOverall.pricePerUnit) {
                                      pricePerUnitClasses = "bg-destructive/10 border-destructive/30 text-destructive font-semibold";
                                    }
                                 }

                                const savingKey = `${product.id}_${offer.uiId}`;
                                 return (
                                   <div key={offer.uiId} className="p-3 border rounded-md bg-background shadow-sm space-y-3">
                                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] gap-2 items-end">
                                       <div>
                                         <label htmlFor={`brand-${product.id}-${offer.uiId}`} className="block text-xs font-medium text-muted-foreground mb-1">Sua Marca Ofertada *</label>
                                         <Input id={`brand-${product.id}-${offer.uiId}`} ref={ref => { brandInputRefs.current[`${product.id}_${offer.uiId}`] = ref; }} value={offer.brandOffered} onChange={(e) => handleOfferChange(product.id, offer.uiId, 'brandOffered', e.target.value)} placeholder="Ex: Marca Top" disabled={isQuotationEnded || isLockedOut || offer.isSuggestedBrand} className={offer.isSuggestedBrand ? 'input-disabled-with-value' : ''} />
                                       </div>
                                       <div>
                                         <label htmlFor={`packaging-${product.id}-${offer.uiId}`} className="block text-xs font-medium text-muted-foreground mb-1">Descrição da Embalagem *</label>
                                         <Input id={`packaging-${product.id}-${offer.uiId}`} value={offer.packagingDescription} onChange={(e) => handleOfferChange(product.id, offer.uiId, 'packagingDescription', e.target.value)} placeholder="Ex: Caixa com 12 Unid." disabled={isQuotationEnded || isLockedOut} />
                                       </div>
                                       <div>
                                         <label htmlFor={`units-${product.id}-${offer.uiId}`} className="block text-xs font-medium text-muted-foreground mb-1">Total Un na Emb. *</label>
                                         <Input id={`units-${product.id}-${offer.uiId}`} type="number" value={offer.unitsInPackaging} onChange={(e) => handleOfferChange(product.id, offer.uiId, 'unitsInPackaging', e.target.value)} placeholder="Ex: 12" disabled={isQuotationEnded || isLockedOut} />
                                       </div>
                                       <div>
                                         <label htmlFor={`price-${product.id}-${offer.uiId}`} className="block text-xs font-medium text-muted-foreground mb-1">Preço Total da Emb. (R$) *</label>
                                         <Input id={`price-${product.id}-${offer.uiId}`} type="number" step="0.01" value={offer.totalPackagingPrice} onChange={(e) => handleOfferChange(product.id, offer.uiId, 'totalPackagingPrice', e.target.value)} placeholder="Ex: 120.50" disabled={isQuotationEnded || isLockedOut} />
                                       </div>
                                       <div className="flex flex-col items-start sm:items-end">
                                           <label className="block text-xs font-medium text-muted-foreground mb-1 sm:invisible">Preço por Unidade</label>
                                           <div className="flex items-center justify-between w-full sm:justify-end">
                                              <span className={`text-md h-10 flex items-center px-3 py-2 rounded-md border ${pricePerUnitClasses}`}>{formatCurrency(pricePerUnit)} / {abbreviateUnit(product.unit)}</span>
                                           </div>
                                       </div>
                                     </div>
                                     <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
                                       {isMyOfferOutbid ? (
                                           <div className="flex items-center gap-4">
                                                <span className="text-xs text-muted-foreground mr-1">Cobrir oferta:</span>
                                                {[1, 2, 3, 4, 5].map((p) => (
                                                    <Button
                                                    key={p}
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 px-2 text-xs border-primary/50 text-primary hover:bg-primary/10 hover:text-primary"
                                                    onClick={() => handleBeatOfferClick(product.id, offer.uiId, p)}
                                                    disabled={isSaving[savingKey] || isQuotationEnded || !offer.unitsInPackaging || Number(offer.unitsInPackaging) <= 0 || isLockedOut}
                                                    >
                                                    -{p}%
                                                    </Button>
                                                ))}
                                            </div>
                                       ) : (
                                         <div></div> // Placeholder to keep layout consistent
                                       )}
                                       <div className="flex flex-col sm:flex-row gap-2 justify-end">
                                         <Button variant="outline" size="sm" onClick={() => removeOfferField(product.id, offer)} disabled={isSaving[savingKey] || isQuotationEnded || isLockedOut} className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50 hover:border-destructive">
                                           {isSaving[savingKey] && offer.id ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                           Remover Oferta
                                         </Button>
                                         <Button onClick={() => handleSaveProductOffer(product.id, offer.uiId)} disabled={isSaving[savingKey] || isQuotationEnded || isLockedOut} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                                            {isSaving[savingKey] && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                                            {isQuotationEnded ? 'Prazo Encerrado' : (offer.id ? 'Atualizar Oferta' : 'Salvar Nova Oferta')}
                                         </Button>
                                       </div>
                                     </div>
                                   </div>
                                 );
                               })}
                           </CardContent>
                      </div>
                  )}
                </Card>
              )
            })}
      </section>
      
      <footer className="mt-8 py-6 border-t" />
    </div>
  );
}