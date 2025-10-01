"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/config/firebase";
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp, collection, query, where, getDocs, Timestamp, addDoc, deleteDoc, updateDoc, arrayUnion, collectionGroup } from "firebase/firestore";
import type { Quotation, Offer, ShoppingListItem, Fornecedor as SupplierType, UnitOfMeasure, PendingBrandRequest } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription as AlertPrimitiveDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { voiceMessages } from "@/config/voiceMessages";


const QUOTATIONS_COLLECTION = "quotations";
const FORNECEDORES_COLLECTION = "fornecedores";
const SHOPPING_LIST_ITEMS_COLLECTION = "shopping_list_items";
const PENDING_BRAND_REQUESTS_COLLECTION = "pending_brand_requests";

// Utility function to handle preferredBrands as both string and array
const getPreferredBrandsArray = (preferredBrands: string | string[] | undefined): string[] => {
  if (!preferredBrands) return [];
  if (Array.isArray(preferredBrands)) return preferredBrands;
  return preferredBrands.split(',').map(b => b.trim());
};


const dayMap = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

interface OfferWithUI extends Offer {
  uiId: string; 
  isSuggestedBrand?: boolean;
  showBeatOfferOptions?: boolean;
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
  categoryName?: string;
  pendingBrandRequests?: PendingBrandRequest[]; // Nova propriedade para solicitações pendentes
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

// Funções para formatação monetária
const formatCurrencyInput = (centavos: number): string => {
  const reais = centavos / 100;
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseCurrencyInput = (value: string): number => {
  // Remove tudo exceto números
  const numbersOnly = value.replace(/[^\d]/g, '');
  // Converte para centavos (número inteiro)
  return parseInt(numbersOnly) || 0;
};

const handleCurrencyInputChange = (value: string): string => {
  const centavos = parseCurrencyInput(value);
  return formatCurrencyInput(centavos);
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
  const { speak } = useVoiceAssistant();

  const quotationId = params.quotationId as string;
  const supplierId = params.supplierId as string; // ID of the supplier currently viewing the portal

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [currentSupplierDetails, setCurrentSupplierDetails] = useState<SupplierType | null>(null);
  const [productsToQuote, setProductsToQuote] = useState<ProductToQuoteVM[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [unseenAlerts, setUnseenAlerts] = useState<string[]>([]);
  const [expandedProductIds, setExpandedProductIds] = useState<string[]>([]);
  const [showStopQuotingModal, setShowStopQuotingModal] = useState(false);
  const [offerToStop, setOfferToStop] = useState<{productId: string, offerUiId: string, productName: string} | null>(null);
  const [stoppedQuotingProducts, setStoppedQuotingProducts] = useState<Set<string>>(new Set());
  const [editingOffers, setEditingOffers] = useState<Set<string>>(new Set()); // productId_offerUiId
  const [savingOffers, setSavingOffers] = useState<Set<string>>(new Set()); // productId_offerUiId
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("all");

  // Estados para o modal de nova marca
  const [newBrandModal, setNewBrandModal] = useState({
    isOpen: false,
    productId: '',
    productName: ''
  });
  const [newBrandForm, setNewBrandForm] = useState({
    brandName: '',
    packagingDescription: '',
    unitsInPackaging: 0,
    totalPackagingPrice: 0,
    imageFile: null as File | null
  });
  const [isSubmittingNewBrand, setIsSubmittingNewBrand] = useState(false);

  
  const [timeLeft, setTimeLeft] = useState("Calculando...");
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
  
  const activeTimersRef = useRef(new Map<string, NodeJS.Timeout>());
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const brandInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const supplierDetailsCache = useRef(new Map<string, SupplierType>());
  const closingQuotationsRef = useRef(new Set<string>());
  const lastClickRef = useRef<{ action: string; timestamp: number } | null>(null);

  const productsWithMyOffers = useMemo(() => {
    const productIds = new Set<string>();
    productsToQuote.forEach(product => {
        if (product.supplierOffers.some(offer => offer.id)) {
            productIds.add(product.id);
        }
    });
    return productIds;
  }, [productsToQuote]);

  const productCategories = useMemo(() => {
    const categories = new Set<string>();
    productsToQuote.forEach(product => {
      if (product.categoryName) {
        categories.add(product.categoryName);
      }
    });
    return Array.from(categories).sort();
  }, [productsToQuote]);

  const filteredProducts = useMemo(() => {
    if (activeCategoryTab === "all") {
      return productsToQuote;
    }
    return productsToQuote.filter(p => p.categoryName === activeCategoryTab);
  }, [productsToQuote, activeCategoryTab]);

  const handleAutoCloseQuotation = useCallback(async (quotationId: string) => {
    if (closingQuotationsRef.current.has(quotationId)) {
        return;
    }
    console.log(`[SellerPortal] Deadline passed for quotation ${quotationId}. Triggering auto-close action from portal page.`);
    closingQuotationsRef.current.add(quotationId);

    // Optimistic UI update
    const originalQuotationStatus = quotation?.status; // Store original status
    setQuotation(prev => prev ? { ...prev, status: 'Fechada' } : null); // Immediately update to 'Fechada'

    const result = await closeQuotationAndItems(quotationId, quotation?.userId || ''); // Pass userId for authorization
    if(result.success && (result.updatedItemsCount ?? 0) > 0) {
      toast({
        title: "Cotação Encerrada",
        description: "O prazo para esta cotação terminou. Não é mais possível enviar ou editar ofertas.",
      });
    } else if (!result.success) {
      console.error("Portal: Failed to auto-close quotation:", result.error);
      // Revert UI state if server action failed
      setQuotation(prev => prev ? { ...prev, status: originalQuotationStatus || 'Aberta' } : null);
      toast({
        title: "Erro ao Encerrar Cotação",
        description: result.error || "Não foi possível encerrar a cotação automaticamente.",
        variant: "destructive"
      });
    }
    closingQuotationsRef.current.delete(quotationId);
  }, [toast, quotation, setQuotation]);

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

  // Funções para modal de nova marca
  const openNewBrandModal = (productId: string, productName: string) => {
    setNewBrandModal({
      isOpen: true,
      productId,
      productName
    });
    setNewBrandForm({
      brandName: '',
      packagingDescription: '',
      unitsInPackaging: 0,
      totalPackagingPrice: 0,
      imageFile: null
    });
  };

  const closeNewBrandModal = () => {
    setNewBrandModal({
      isOpen: false,
      productId: '',
      productName: ''
    });
    setNewBrandForm({
      brandName: '',
      packagingDescription: '',
      unitsInPackaging: 0,
      totalPackagingPrice: 0,
      imageFile: null
    });
  };

  const handleNewBrandFormChange = (field: keyof typeof newBrandForm, value: any) => {
    setNewBrandForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const uploadImageToVercelBlob = async (file: File): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Use filename as query parameter as expected by the API
      const filename = `brand-images/${Date.now()}-${file.name}`;
      const response = await fetch(`/api/upload?filename=${encodeURIComponent(filename)}`, {
        method: 'POST',
        body: file, // Send file directly, not FormData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Falha no upload da imagem');
      }

      const data = await response.json();
      return data.url;
    } catch (error: any) {
      console.error('Upload error:', error);
      throw new Error('Falha no upload da imagem: ' + error.message);
    }
  };

  const submitNewBrandRequest = async () => {
    if (!quotation || !currentSupplierDetails || !newBrandModal.productId) {
      toast({ title: "Erro", description: "Dados insuficientes para enviar solicitação.", variant: "destructive" });
      return;
    }

    if (!newBrandForm.brandName.trim() || !newBrandForm.packagingDescription.trim() || 
        newBrandForm.unitsInPackaging <= 0 || newBrandForm.totalPackagingPrice <= 0) {
      toast({ title: "Erro", description: "Todos os campos são obrigatórios.", variant: "destructive" });
      return;
    }

    setIsSubmittingNewBrand(true);

    try {
      let imageUrl = '';
      if (newBrandForm.imageFile) {
        try {
          imageUrl = await uploadImageToVercelBlob(newBrandForm.imageFile);
        } catch (error: any) {
          console.warn('Image upload failed, continuing without image:', error);
          // Continue without image if upload fails
        }
      }

      const pricePerUnit = newBrandForm.totalPackagingPrice / newBrandForm.unitsInPackaging;

      const brandRequestData = {
        quotationId: quotation.id,
        productId: newBrandModal.productId,
        supplierId: supplierId,
        supplierName: currentSupplierDetails.empresa,
        supplierInitials: currentSupplierDetails.vendedor.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
        brandName: newBrandForm.brandName.trim(),
        packagingDescription: newBrandForm.packagingDescription.trim(),
        unitsInPackaging: newBrandForm.unitsInPackaging,
        totalPackagingPrice: newBrandForm.totalPackagingPrice,
        pricePerUnit: pricePerUnit,
        imageUrl: imageUrl,
        imageFileName: newBrandForm.imageFile?.name || '',
        userId: quotation.userId,
      };

      // Try to create via API route (bypasses Firestore rules)
      const response = await fetch('/api/brand-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(brandRequestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao enviar solicitação');
      }

      const result = await response.json();
      
      toast({ 
        title: "Solicitação Enviada!", 
        description: "Sua nova marca foi enviada para aprovação do comprador.",
        variant: "default"
      });

      closeNewBrandModal();

    } catch (error: any) {
      console.error("Error submitting brand request:", error);
      
      // Check if it's a permission error
      if (error.code === 'permission-denied') {
        toast({ 
          title: "Erro de Permissão", 
          description: "As regras do Firestore precisam ser atualizadas para permitir solicitações de marca. Entre em contato com o administrador.", 
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: "Erro ao Enviar Solicitação", 
          description: error.message || "Erro desconhecido. Tente novamente.", 
          variant: "destructive" 
        });
      }
    setIsSubmittingNewBrand(false);
  };

  }




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

        // Fetch pending brand requests at the same time
        const pendingRequestsQuery = query(
          collection(db, PENDING_BRAND_REQUESTS_COLLECTION),
          where("quotationId", "==", quotationId),
          where("supplierId", "==", supplierId),
          where("status", "==", "pending")
        );
        const pendingRequestsSnapshot = await getDocs(pendingRequestsQuery);
        const allPendingRequests = pendingRequestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingBrandRequest));
        
        const fetchedProducts = shoppingListSnapshot.docs.map(docSnap => {
          const itemData = docSnap.data() as ShoppingListItem;
          
          let isMismatch = false;
          if (itemData.hasSpecificDate && itemData.deliveryDate) {
            const deliveryDate = itemData.deliveryDate.toDate();
            const deliveryDay = dayMap[deliveryDate.getDay()];
            isMismatch = !supplierDeliveryDays.includes(deliveryDay);
          }

          // Find pending requests for this specific product
          const productPendingRequests = allPendingRequests.filter(req => req.productId === docSnap.id);
          
          return {
            ...itemData,
            id: docSnap.id,
            supplierOffers: [], 
            bestOffersByBrand: [],
            lowestPriceThisProductHas: null,
            isDeliveryDayMismatch: isMismatch,
            counterProposalInfo: null,
            isLockedOut: false,
            pendingBrandRequests: productPendingRequests // Initialize with fetched data
          } as ProductToQuoteVM;
        }).sort((a,b) => a.name.localeCompare(b.name));
        
        setProductsToQuote(fetchedProducts);

        // Mensagem de boas-vindas quando carregar os dados
        speak(voiceMessages.welcome.quotationPage(quotationId));

      } catch (error: any) {
        console.error("ERROR fetching initial data for seller quotation page:", error);
        toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
        speak(voiceMessages.error.loadFailed);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, [quotationId, supplierId, toast, speak]);

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


  // Effect to listen for pending brand requests
  useEffect(() => {
    if (!quotationId || !supplierId) return;

    const pendingRequestsQuery = query(
      collection(db, PENDING_BRAND_REQUESTS_COLLECTION),
      where("quotationId", "==", quotationId),
      where("supplierId", "==", supplierId),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(pendingRequestsQuery, (snapshot) => {
      const pendingRequests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PendingBrandRequest));

      // Update products to include pending requests
      setProductsToQuote(prevProducts =>
        prevProducts.map(product => {
          const productPendingRequests = pendingRequests.filter(req => req.productId === product.id);
          console.log(`🔶 Product ${product.name} pending requests:`, productPendingRequests);
          return {
            ...product,
            pendingBrandRequests: productPendingRequests
          };
        })
      );
    });

    return () => unsubscribe();
  }, [quotationId, supplierId]);

  // Effect to listen for real-time changes in shopping_list_items (preferred brands updates)
  useEffect(() => {
    if (!quotationId) return;

    const shoppingListItemsQuery = query(
      collection(db, SHOPPING_LIST_ITEMS_COLLECTION),
      where("quotationId", "==", quotationId)
    );

    const unsubscribe = onSnapshot(shoppingListItemsQuery, (snapshot) => {
      // Update products with new preferred brands
      setProductsToQuote(prevProducts => {
        const updatedProducts = prevProducts.map(product => {
          const updatedDoc = snapshot.docs.find(doc => doc.id === product.id);
          if (updatedDoc) {
            const updatedData = updatedDoc.data() as ShoppingListItem;
            console.log(`📦 Updated product ${product.name} with new preferredBrands:`, updatedData.preferredBrands);
            return {
              ...product,
              preferredBrands: updatedData.preferredBrands,
              updatedAt: updatedData.updatedAt
            };
          }
          return product;
        });
        
        return updatedProducts;
      });
    });

    return () => unsubscribe();
  }, [quotationId]);


  useEffect(() => {
    if (!quotationId || !supplierId || productsToQuote.length === 0 || !currentSupplierDetails || isLoading || !quotation) return ()=>{};

    // Create individual listeners for each product's offers
    const unsubscribers = productsToQuote.map(product => {
      const offersPath = `quotations/${quotationId}/products/${product.id}/offers`;
      const offersQuery = query(collection(db, offersPath));

      return onSnapshot(offersQuery, async (offersSnapshot) => {
        const offersData = offersSnapshot.docs.map(doc => ({ ...doc.data() as Offer, id: doc.id, uiId: doc.id }));

        // Fetch new supplier details
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

        // Update the specific product
        setProductsToQuote(currentProducts => {
          return currentProducts.map(p => {
            if (p.id === product.id) {
              // Get local offers that are not yet saved to Firestore
              const localUnsavedOffers = p.supplierOffers.filter(o => !o.id);

              // From the unsaved local offers, filter out any that now exist in Firestore
              const trulyLocalOffers = localUnsavedOffers.filter(localOffer => {
                const hasMatchInFirestore = myOffers.some(firestoreOffer =>
                  firestoreOffer.brandOffered === localOffer.brandOffered &&
                  firestoreOffer.supplierId === localOffer.supplierId &&
                  Number(firestoreOffer.totalPackagingPrice) === Number(localOffer.totalPackagingPrice) &&
                  Number(firestoreOffer.unitsInPackaging) === Number(localOffer.unitsInPackaging) &&
                  firestoreOffer.packagingDescription === localOffer.packagingDescription
                );
                return !hasMatchInFirestore;
              });

              // The new list of offers is the one from Firestore plus any truly local ones that haven't been saved
              const updatedOffers = [...myOffers, ...trulyLocalOffers].sort((a, b) => (a.brandOffered || '').localeCompare(b.brandOffered || ''));

              return {
                ...p,
                supplierOffers: updatedOffers,
                bestOffersByBrand: brandDisplays,
                lowestPriceThisProductHas: lowestPriceOverall,
                counterProposalInfo,
                isLockedOut
              };
            }
            return p;
          });
        });
      }, (error) => {
        console.error(`🔴 [Portal] Error in offers listener for product ${product.id}:`, error);
      });
    });

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

  // Effect for voice narration when changing tabs
  useEffect(() => {
    const tabMessages: Record<string, string> = {
      all: voiceMessages.tabs.all,
      obrigatorios: voiceMessages.tabs.required,
      opcionais: voiceMessages.tabs.optional,
      enviados: voiceMessages.tabs.sent,
    };

    const message = tabMessages[activeCategoryTab];
    if (message && !isLoading) {
      speak(message);
    }
  }, [activeCategoryTab, isLoading, speak]);

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

  const handleOfferChange = (productId: string, offerUiId: string, field: keyof OfferWithUI, value: string | number | boolean) => {
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

  const handlePriceChange = (productId: string, offerUiId: string, inputValue: string) => {
    // Parse centavos do input formatado
    const centavos = parseCurrencyInput(inputValue);
    // Converte para valor decimal para armazenamento
    const decimalValue = centavos / 100;
    // Atualiza o estado com o valor decimal
    handleOfferChange(productId, offerUiId, 'totalPackagingPrice', decimalValue);
  };

  const handleStopQuotingClick = (productId: string, offerUiId: string, productName: string) => {
    setOfferToStop({ productId, offerUiId, productName });
    setShowStopQuotingModal(true);
  };

  const confirmStopQuoting = async () => {
    if (!offerToStop) return;

    const { productId, offerUiId } = offerToStop;
    const product = productsToQuote.find(p => p.id === productId);
    const offer = product?.supplierOffers.find(o => o.uiId === offerUiId);

    if (offer && offer.id) {
      // Remove a oferta do banco de dados
      await removeOfferField(productId, offer);
    }

    // Marca o produto como "parado de cotar"
    setStoppedQuotingProducts(prev => new Set(prev).add(productId));

    setShowStopQuotingModal(false);
    setOfferToStop(null);
    toast({
      title: "Parou de Cotar",
      description: `Você parou de cotar "${offerToStop.productName}". Não poderá mais fazer ofertas para este item nesta cotação.`,
    });
  };

  const isCounterProposalExpired = (product: ProductToQuoteVM): boolean => {
    if (!product.counterProposalInfo) return false;
    return new Date() > product.counterProposalInfo.deadline;
  };

  const toggleEditMode = (productId: string, offerUiId: string) => {
    const editKey = `${productId}_${offerUiId}`;
    setEditingOffers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(editKey)) {
        newSet.delete(editKey);
      } else {
        newSet.add(editKey);
      }
      return newSet;
    });
  };

  const isInEditMode = (productId: string, offerUiId: string): boolean => {
    return editingOffers.has(`${productId}_${offerUiId}`);
  };

  const addOfferField = (productId: string, brandToPreFill?: string, isSuggested?: boolean) => {
    console.log(`[ADD-OFFER-DEBUG] addOfferField ENTRY:`, {
      productId,
      brandToPreFill,
      isSuggested,
      timestamp: Date.now(),
      currentSupplierDetails: !!currentSupplierDetails
    });

    // Prevent duplicate execution
    const executionKey = `addOffer-${productId}-${brandToPreFill}-${isSuggested}`;
    if (lastClickRef.current?.action === executionKey && Date.now() - lastClickRef.current.timestamp < 500) {
      console.log(`[ADD-OFFER-DEBUG] PREVENTED duplicate execution of ${executionKey}`);
      return;
    }
    lastClickRef.current = { action: executionKey, timestamp: Date.now() };

    if (!currentSupplierDetails) {
        console.log(`[ADD-OFFER-DEBUG] ERROR: No supplier details available`);
        toast({title: "Erro", description: "Dados do fornecedor não carregados.", variant: "destructive"});
        return;
    }

    if (!expandedProductIds.includes(productId)) {
      console.log(`[ADD-OFFER-DEBUG] Expanding product ${productId}`);
      setExpandedProductIds(prev => [...prev, productId]);
    }

    const newOfferUiId = Date.now().toString() + Math.random().toString(36).substring(2,7);
    console.log(`[ADD-OFFER-DEBUG] Generated new offer uiId: ${newOfferUiId}`);

    setProductsToQuote(prevProducts => {
      console.log(`[ADD-OFFER-DEBUG] setProductsToQuote STARTING for new offer creation`);
      const targetProduct = prevProducts.find(p => p.id === productId);
      if (targetProduct) {
        console.log(`[ADD-OFFER-DEBUG] BEFORE adding - ${targetProduct.name} has ${targetProduct.supplierOffers.length} offers:`,
          targetProduct.supplierOffers.map(o => ({ uiId: o.uiId, brand: o.brandOffered, hasId: !!o.id, isSuggested: o.isSuggestedBrand }))
        );
      }
      const updatedProducts = prevProducts.map(p => {
        if (p.id === productId) {
            console.log(`[OFFER-DEBUG] Before adding offer - ${p.name} has ${p.supplierOffers.length} offers:`,
              p.supplierOffers.map(o => ({ uiId: o.uiId, brand: o.brandOffered, hasId: !!o.id }))
            );
            const newOffer: OfferWithUI = {
                uiId: newOfferUiId,
                quotationId: quotationId, // Adicionar campo obrigatório
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
            console.log(`[ADD-OFFER-DEBUG] CREATING new offer:`, {
              uiId: newOffer.uiId,
              brand: newOffer.brandOffered,
              isSuggestedBrand: newOffer.isSuggestedBrand,
              productName: p.name
            });

            const updatedProduct = {
                ...p,
                supplierOffers: [...p.supplierOffers, newOffer],
            };
            console.log(`[OFFER-DEBUG] After adding offer - ${p.name} will have ${updatedProduct.supplierOffers.length} offers:`,
              updatedProduct.supplierOffers.map(o => ({ uiId: o.uiId, brand: o.brandOffered, hasId: !!o.id }))
            );
             // Don't auto-focus for suggested brands - they should appear pre-filled but not editable
             if (!brandToPreFill) {
               setTimeout(() => {
                  const brandInputRef = brandInputRefs.current[`${productId}_${newOfferUiId}`];
                  brandInputRef?.focus();
              }, 0);
             } else {
               console.log(`[OFFER-DEBUG] Skipping auto-focus for suggested brand: ${brandToPreFill}`);
             }
            return updatedProduct;
        }
        return p;
      });
      console.log(`[ADD-OFFER-DEBUG] setProductsToQuote COMPLETED for new offer creation`);
      return updatedProducts;
    });
    console.log(`[ADD-OFFER-DEBUG] addOfferField COMPLETED for ${productId}`);
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
    // Debounce rapid clicks
    const now = Date.now();
    const actionKey = `suggested-${productId}-${brandName}`;
    console.log(`[CLICK-DEBUG] handleSuggestedBrandClick ENTRY:`, {
      productId,
      brandName,
      actionKey,
      timestamp: now,
      lastClick: lastClickRef.current
    });

    if (lastClickRef.current?.action === actionKey && now - lastClickRef.current.timestamp < 300) {
      console.log(`[CLICK-DEBUG] DEBOUNCED - ignoring rapid click for ${actionKey}`);
      return;
    }
    lastClickRef.current = { action: actionKey, timestamp: now };
    console.log(`[CLICK-DEBUG] PROCEEDING with click ${actionKey}`);

    console.log(`[OFFER-DEBUG] handleSuggestedBrandClick called:`, { productId, brandName });
    const product = productsToQuote.find(p => p.id === productId);
    if (!product) return;

    const unsavedOfferIndex = product.supplierOffers.findIndex(o => !o.id);
    console.log(`[OFFER-DEBUG] Current offers for ${product.name}:`, {
      totalOffers: product.supplierOffers.length,
      unsavedOfferIndex,
      offers: product.supplierOffers.map(o => ({ uiId: o.uiId, brand: o.brandOffered, hasId: !!o.id }))
    });

    if (unsavedOfferIndex !== -1) {
        // There is an unsaved offer, so update it.
        console.log(`[OFFER-DEBUG] Updating existing unsaved offer with brand: ${brandName}`);
        const currentOffer = product.supplierOffers[unsavedOfferIndex];
        console.log(`[OFFER-DEBUG] Current offer being updated:`, {
          uiId: currentOffer.uiId,
          oldBrand: currentOffer.brandOffered,
          newBrand: brandName,
          isSuggestedBrand: currentOffer.isSuggestedBrand,
          hasId: !!currentOffer.id
        });
        // Update both the brand name and mark as suggested brand
        const offerUiId = product.supplierOffers[unsavedOfferIndex].uiId;
        console.log(`[STATE-DEBUG] BEFORE suggested brand update - offer state:`, {
          uiId: offerUiId,
          oldBrand: product.supplierOffers[unsavedOfferIndex].brandOffered,
          oldIsSuggested: product.supplierOffers[unsavedOfferIndex].isSuggestedBrand,
          newBrand: brandName
        });

        // Prevent double execution using useCallback-like pattern
        const stateUpdateKey = `updateBrand-${productId}-${offerUiId}-${brandName}`;
        if (lastClickRef.current?.action === stateUpdateKey && Date.now() - lastClickRef.current.timestamp < 200) {
          console.log(`[STATE-DEBUG] PREVENTED duplicate state update for ${stateUpdateKey}`);
          return;
        }
        lastClickRef.current = { action: stateUpdateKey, timestamp: Date.now() };

        setProductsToQuote(prevProducts => {
          console.log(`[STATE-DEBUG] setProductsToQuote STARTING for suggested brand`);
          const result = prevProducts.map(p => {
            if (p.id === productId) {
              const updatedOffers = p.supplierOffers.map(offer => {
                if (offer.uiId === offerUiId) {
                  const updatedOffer = {
                    ...offer,
                    brandOffered: brandName,
                    isSuggestedBrand: true
                  };
                  console.log(`[STATE-DEBUG] UPDATING offer:`, {
                    uiId: offer.uiId,
                    from: { brand: offer.brandOffered, isSuggested: offer.isSuggestedBrand },
                    to: { brand: brandName, isSuggested: true }
                  });
                  return updatedOffer;
                }
                return offer;
              });
              return { ...p, supplierOffers: updatedOffers };
            }
            return p;
          });
          console.log(`[STATE-DEBUG] setProductsToQuote COMPLETED for suggested brand`);
          return result;
        });
    } else {
        // There are no unsaved offers, so add a new one.
        console.log(`[OFFER-DEBUG] Adding new offer field with brand: ${brandName} - this is FIRST CLICK`);
        addOfferField(productId, brandName, true); // Mark as suggested brand so it's non-editable
    }
  };

  const handleOtherBrandClick = (productId: string) => {
    // Debounce rapid clicks
    const now = Date.now();
    const actionKey = `other-${productId}`;
    console.log(`[CLICK-DEBUG] handleOtherBrandClick ENTRY:`, {
      productId,
      actionKey,
      timestamp: now,
      lastClick: lastClickRef.current
    });

    if (lastClickRef.current?.action === actionKey && now - lastClickRef.current.timestamp < 300) {
      console.log(`[CLICK-DEBUG] DEBOUNCED - ignoring rapid other brand click for ${actionKey}`);
      return;
    }
    lastClickRef.current = { action: actionKey, timestamp: now };
    console.log(`[CLICK-DEBUG] PROCEEDING with other brand click ${actionKey}`);

    console.log(`[OFFER-DEBUG] handleOtherBrandClick called:`, { productId });
    const product = productsToQuote.find(p => p.id === productId);
    if (!product) return;

    const unsavedOfferIndex = product.supplierOffers.findIndex(o => !o.id);
    console.log(`[OFFER-DEBUG] Other brand click - Current offers for ${product.name}:`, {
      totalOffers: product.supplierOffers.length,
      unsavedOfferIndex,
      offers: product.supplierOffers.map(o => ({ uiId: o.uiId, brand: o.brandOffered, hasId: !!o.id }))
    });

    if (unsavedOfferIndex === -1) {
        // Only add a new field if there are no unsaved offers
        console.log(`[OFFER-DEBUG] Adding new empty offer field`);
        addOfferField(productId, '', false);
    } else {
        // Convert existing unsaved offer to "other brand" (clear brand and make editable)
        const currentOffer = product.supplierOffers[unsavedOfferIndex];
        console.log(`[OFFER-DEBUG] Converting existing offer to 'other brand' mode:`, {
          uiId: currentOffer.uiId,
          oldBrand: currentOffer.brandOffered,
          oldIsSuggested: currentOffer.isSuggestedBrand
        });

        console.log(`[STATE-DEBUG] BEFORE other brand conversion - offer state:`, {
          uiId: currentOffer.uiId,
          oldBrand: currentOffer.brandOffered,
          oldIsSuggested: currentOffer.isSuggestedBrand
        });

        // Prevent double execution
        const conversionKey = `convertOther-${productId}-${currentOffer.uiId}`;
        if (lastClickRef.current?.action === conversionKey && Date.now() - lastClickRef.current.timestamp < 200) {
          console.log(`[STATE-DEBUG] PREVENTED duplicate other brand conversion for ${conversionKey}`);
          return;
        }
        lastClickRef.current = { action: conversionKey, timestamp: Date.now() };

        setProductsToQuote(prevProducts => {
          console.log(`[STATE-DEBUG] setProductsToQuote STARTING for other brand conversion`);
          const result = prevProducts.map(p => {
            if (p.id === productId) {
              const updatedOffers = [...p.supplierOffers];
              const originalOffer = updatedOffers[unsavedOfferIndex];
              updatedOffers[unsavedOfferIndex] = {
                ...originalOffer,
                brandOffered: '',
                isSuggestedBrand: false
              };
              console.log(`[STATE-DEBUG] CONVERTING offer to other brand:`, {
                uiId: originalOffer.uiId,
                from: { brand: originalOffer.brandOffered, isSuggested: originalOffer.isSuggestedBrand },
                to: { brand: '', isSuggested: false }
              });
              return { ...p, supplierOffers: updatedOffers };
            }
            return p;
          });
          console.log(`[STATE-DEBUG] setProductsToQuote COMPLETED for other brand conversion`);
          return result;
        });
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
    // Debounce rapid save clicks
    const now = Date.now();
    const actionKey = `save-${productId}-${offerUiId}`;
    if (lastClickRef.current?.action === actionKey && now - lastClickRef.current.timestamp < 1000) {
      console.log(`[OFFER-DEBUG] Debouncing save request for ${actionKey}`);
      return;
    }
    lastClickRef.current = { action: actionKey, timestamp: now };

    console.log(`[OFFER-DEBUG] handleSaveProductOffer called:`, { productId, offerUiId });
    if (!currentSupplierDetails || !quotation || !quotation.userId) {
        toast({title: "Erro Interno", description: "Dados do fornecedor, cotação ou ID do comprador ausentes.", variant: "destructive"});
        return;
    }
    const product = productsToQuote.find(p => p.id === productId);
    if (!product) return;

    console.log(`[OFFER-DEBUG] Before save - ${product.name} has ${product.supplierOffers.length} offers:`,
      product.supplierOffers.map(o => ({ uiId: o.uiId, brand: o.brandOffered, hasId: !!o.id }))
    );

    const offerToSaveIndex = product.supplierOffers.findIndex(o => o.uiId === offerUiId);
    if (offerToSaveIndex === -1) {
        console.log(`[OFFER-DEBUG] ERROR: Offer with uiId ${offerUiId} not found!`);
        toast({title: "Erro", description: "Oferta não encontrada para salvar.", variant: "destructive"});
        return;
    }
    const offerData = product.supplierOffers[offerToSaveIndex];
    console.log(`[OFFER-DEBUG] Found offer to save:`, {
      uiId: offerData.uiId,
      brand: offerData.brandOffered,
      hasId: !!offerData.id,
      index: offerToSaveIndex
    }); 

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
      quotationId: quotationId, // Adicionar campo obrigatório
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
    // Adiciona a oferta à lista de ofertas sendo salvas
    setSavingOffers(prev => new Set(prev).add(savingKey));
    
    try {
      if (offerData.id) {
        console.log(`[OFFER-DEBUG] Updating existing offer in Firestore with ID: ${offerData.id}`);
        const offerRef = doc(db, `quotations/${quotationId}/products/${productId}/offers/${offerData.id}`);
        await updateDoc(offerRef, offerPayload);
        console.log(`[OFFER-DEBUG] Successfully updated offer ${offerData.id} in Firestore`);
        toast({ title: "Oferta Atualizada!", description: `Sua oferta para ${product.name} (${offerData.brandOffered}) foi atualizada.` });
        speak(voiceMessages.success.offerSaved);
      } else {
        // Check if an offer with the same brand and price already exists for this supplier
        const existingOfferQuery = query(
          collection(db, `quotations/${quotationId}/products/${productId}/offers`),
          where('supplierId', '==', currentSupplierDetails.id),
          where('brandOffered', '==', offerData.brandOffered),
          where('pricePerUnit', '==', pricePerUnit)
        );
        const existingOfferSnap = await getDocs(existingOfferQuery);

        if (!existingOfferSnap.empty) {
          console.log(`[OFFER-DEBUG] Duplicate offer detected, skipping Firestore creation`);
          toast({title: "Oferta Duplicada", description: "Esta oferta já existe.", variant: "destructive"});
          setIsSaving(prev => ({ ...prev, [savingKey]: false }));
          setSavingOffers(prev => {
            const newSet = new Set(prev);
            newSet.delete(savingKey);
            return newSet;
          });
          return;
        }

        console.log(`[OFFER-DEBUG] Creating new offer in Firestore`);
        const offerCollectionRef = collection(db, `quotations/${quotationId}/products/${productId}/offers`);
        const newOfferDocRef = await addDoc(offerCollectionRef, offerPayload);
        console.log(`[OFFER-DEBUG] Successfully created new offer with ID: ${newOfferDocRef.id}`);


        toast({ title: "Oferta Salva!", description: `Sua oferta para ${product.name} (${offerData.brandOffered}) foi salva.` });
        speak(voiceMessages.success.offerSaved);
      }

      console.log(`[OFFER-DEBUG] Save completed successfully for offer ${offerUiId}`);
      setUnseenAlerts(prev => prev.filter(alertId => alertId !== productId));
      handleOfferChange(productId, offerUiId, 'showBeatOfferOptions', false); // Reset the flag after saving
    } catch (error: any) {
      console.log(`[OFFER-DEBUG] ERROR during save:`, error);
      toast({ title: "Erro ao Salvar Oferta", description: error.message, variant: "destructive" });
      speak(voiceMessages.error.saveFailed);
    } finally {
      setIsSaving(prev => ({ ...prev, [savingKey]: false }));
      // Remove a oferta da lista de ofertas sendo salvas
      setSavingOffers(prev => {
        const newSet = new Set(prev);
        newSet.delete(savingKey);
        return newSet;
      });
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

    // Manter os botões visíveis para navegação
    handleOfferChange(productId, offerUiId, 'showBeatOfferOptions', true);

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
                <Badge variant="warning" className="flex items-center gap-1.5 text-sm p-2 animate-pulse order-first sm:order-none">
                    <Bell className="h-4 w-4"/> {unseenAlerts.length} Alerta(s) de Preço!
                </Badge>
            )}
        </div>
        <div className="flex flex-row justify-end items-center gap-4">
          <div className={`flex items-center gap-3 p-3 rounded-lg shadow-sm border ${isQuotationEnded ? 'bg-destructive/10 border-destructive text-destructive' : 'bg-card border-border'}`}>
              {!isQuotationEnded && (
                  <>
                    <Clock className={`h-5 w-5 ${isQuotationEnded ? 'text-destructive' : 'text-primary'}`} />
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${isQuotationEnded ? 'text-destructive' : 'text-primary'}`}>{timeLeft}</span>
                      <span className="text-xs text-muted-foreground">
                        (Prazo Final: {quotation.deadline ? format(quotation.deadline.toDate(), "dd/MM/yyyy HH:mm", {locale: ptBR}) : 'N/A'})
                      </span>
                    </div>
                  </>
              )}
              {isQuotationEnded && (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-destructive">Prazo Encerrado</span>
                    <span className="text-xs text-destructive/70">
                      (Prazo Final: {quotation.deadline ? format(quotation.deadline.toDate(), "dd/MM/yyyy HH:mm", {locale: ptBR}) : 'N/A'})
                    </span>
                  </div>
              )}
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
              <Tabs value={activeCategoryTab} onValueChange={setActiveCategoryTab} className="w-full">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-foreground">Produtos para Cotação ({filteredProducts.length})</h2>
                  <TabsList>
                    <TabsTrigger value="all">Todos</TabsTrigger>
                    {productCategories.map(category => (
                      <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                <TabsContent value={activeCategoryTab}>
                  {filteredProducts.length === 0 && !isLoading ? (
                      <Card><CardContent className="p-6 text-center"><p className="text-muted-foreground">Nenhum item encontrado nesta categoria.</p></CardContent></Card>
                  ) : filteredProducts.map((product, index) => {
                    const hasUnseenAlert = unseenAlerts.includes(product.id);
                    const isExpanded = expandedProductIds.includes(product.id);
                    const isDeliveryMismatch = product.hasSpecificDate && product.isDeliveryDayMismatch;
                    const hasMyOffers = productsWithMyOffers.has(product.id);
                    const isLockedOut = !!product.isLockedOut;
      
                    // New logic for pulsating border on main product card
                    const mySavedOffers = product.supplierOffers.filter(offer => offer.supplierId === supplierId && offer.id);
                    const isMyOfferWinning = mySavedOffers.some(offer => offer.pricePerUnit === product.lowestPriceThisProductHas);
                    const isMyOfferLosing = mySavedOffers.some(offer => offer.pricePerUnit > 0) && !isMyOfferWinning;
      
                    return (
                      <Card key={product.id} className={`border-2 ${
                          isMyOfferWinning ? 'animate-pulse-glow-green' :
                          isMyOfferLosing ? 'animate-pulse-glow-red' :
                          hasUnseenAlert ? 'border-orange-500 shadow-lg' : 'border-transparent'
                      }`}>                  <CardHeader className="bg-muted/30 p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleProductExpansion(product.id)}>
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

                                {/* Render pending brand requests with orange cards */}
                                {(() => {
                                  const hasPendingRequests = product.pendingBrandRequests && product.pendingBrandRequests.length > 0;
                                  return hasPendingRequests;
                                })() && (
                                  <div className="flex flex-row flex-wrap gap-2 p-1">
                                      {product.pendingBrandRequests?.map(request => (
                                          <div key={request.id} className="flex items-center justify-between p-2 rounded-md bg-orange-50/50 border-l-4 border-orange-500 min-w-[200px] flex-grow">
                                              <div className="flex items-center gap-3">
                                                  <TooltipProvider>
                                                      <Tooltip>
                                                          <TooltipTrigger asChild>
                                                              <Avatar className="h-8 w-8 shrink-0 cursor-pointer">
                                                                {request.imageUrl ? (
                                                                  <Image 
                                                                    src={request.imageUrl} 
                                                                    alt={request.brandName} 
                                                                    width={40} 
                                                                    height={40} 
                                                                    className="object-cover w-full h-full rounded-full" 
                                                                  />
                                                                ) : (
                                                                  <AvatarFallback className="text-xs bg-orange-100">{request.supplierInitials}</AvatarFallback>
                                                                )}
                                                              </Avatar>
                                                          </TooltipTrigger>
                                                          <TooltipContent side="top" className="bg-background border text-foreground shadow-lg rounded-md text-xs p-2">
                                                            <p className="font-semibold">{request.supplierName}</p>
                                                            <p className="text-muted-foreground">Nova marca proposta</p>
                                                          </TooltipContent>
                                                      </Tooltip>
                                                  </TooltipProvider>
                                                  <div>
                                                      <p className="text-sm font-semibold" title={request.brandName}>{request.brandName}</p>
                                                      <p className="text-xs text-muted-foreground">por {request.supplierName}</p>
                                                  </div>
                                              </div>
                                              <div className="text-right">
                                                  <p className="text-base font-bold text-orange-600">{formatCurrency(request.pricePerUnit)} / {abbreviateUnit(product.unit)}</p>
                                                  <div className="mt-1">
                                                    <Badge variant="outline" className="text-xs border-orange-600 text-orange-700">
                                                      Aguardando Aprovação
                                                    </Badge>
                                                  </div>
                                              </div>
                                          </div>
                                      ))}
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
                                            {getPreferredBrandsArray(product.preferredBrands).map(brand => (
                                                <Badge key={brand.trim()} variant="outline" onClick={() => !isLockedOut && handleSuggestedBrandClick(product.id, brand.trim())} className={isLockedOut ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted hover:border-primary/50'}>{brand.trim()}</Badge>
                                            ))}
                                          </div>
                                        )}
                                        <Badge 
                                          variant="outline" 
                                          onClick={() => !isLockedOut && openNewBrandModal(product.id, product.name)} 
                                          className={`border-primary/70 text-primary/90 ${isLockedOut ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted hover:border-primary/50'}`}
                                        >
                                          <PlusCircle className="mr-1.5 h-3 w-3" /> Outra Marca
                                        </Badge>
                                        {product.notes && <p className="text-muted-foreground mt-2 sm:mt-0"><span className="font-medium">Obs. Comprador:</span> {product.notes}</p>}
                                     </div>
      
      
                                     
                                     {product.supplierOffers.map((offer, offerIndex) => {
                                       const savingKey = `${product.id}_${offer.uiId}`;
                                       const pricePerUnit = calculatePricePerUnit(offer);
                                       let pricePerUnitClasses = "bg-muted";
                                       const bestCompetitorOfferOverall = product.bestOffersByBrand.find(b => !b.isSelf);
                                       const isMyOfferOutbid = offer.id && bestCompetitorOfferOverall && pricePerUnit && pricePerUnit > bestCompetitorOfferOverall.pricePerUnit;
      
                                       // Ativar showBeatOfferOptions automaticamente quando estiver perdendo
                                       if (isMyOfferOutbid && !offer.showBeatOfferOptions) {
                                         setTimeout(() => {
                                           handleOfferChange(product.id, offer.uiId, 'showBeatOfferOptions', true);
                                         }, 0);
                                       }
      
                                       // Calcular condições de desabilitação
                                       const isOfferDisabled = Boolean(
                                         isQuotationEnded ||
                                         isLockedOut ||
                                         stoppedQuotingProducts.has(product.id) ||
                                         isCounterProposalExpired(product) ||
                                         (offer.id && !isInEditMode(product.id, offer.uiId))
                                       );

                                       // Brand field is disabled for suggested brands (non-editable display)
                                       const isBrandFieldDisabled = Boolean(
                                         isOfferDisabled ||
                                         offer.isSuggestedBrand
                                       );

                                       // Debug logging removed to improve performance


                                       const isButtonDisabled = Boolean(
                                         isSaving[savingKey] ||
                                         isQuotationEnded ||
                                         isLockedOut ||
                                         stoppedQuotingProducts.has(product.id) ||
                                         isCounterProposalExpired(product)
                                       );
                                       
                                       if (hasMyOffers && pricePerUnit !== null && bestCompetitorOfferOverall) {
                                          if(pricePerUnit <= bestCompetitorOfferOverall.pricePerUnit) {
                                            pricePerUnitClasses = "bg-green-500/10 border-green-500/40 text-green-700 font-semibold";
                                          } else if (pricePerUnit > bestCompetitorOfferOverall.pricePerUnit) {
                                            pricePerUnitClasses = "bg-destructive/10 border-destructive/30 text-destructive font-semibold";
                                          }
                                       }
      
                                       return (
                                         <div key={`${product.id}-${offerIndex}-${offer.uiId}`} className="p-3 border rounded-md bg-background shadow-sm space-y-3">
                                           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] gap-2 items-end">
                                             <div>
                                               <label htmlFor={`brand-${product.id}-${offer.uiId}`} className="block text-xs font-medium text-muted-foreground mb-1">Sua Marca Ofertada *</label>
                                               <Input
                                                 id={`brand-${product.id}-${offer.uiId}`}
                                                 ref={ref => { brandInputRefs.current[`${product.id}_${offer.uiId}`] = ref; }}
                                                 value={offer.brandOffered}
                                                 onChange={(e) => handleOfferChange(product.id, offer.uiId, 'brandOffered', e.target.value)}
                                                 placeholder="Ex: Marca Top"
                                                 disabled={isBrandFieldDisabled}
                                                 autoFocus={!offer.isSuggestedBrand && offer.brandOffered === ''}
                                                 className={offer.isSuggestedBrand ? 'bg-muted/30' : undefined}
                                               />
                                             </div>
                                             <div>
                                               <label htmlFor={`packaging-${product.id}-${offer.uiId}`} className="block text-xs font-medium text-muted-foreground mb-1">Descrição da Embalagem *</label>
                                               <Input id={`packaging-${product.id}-${offer.uiId}`} value={offer.packagingDescription} onChange={(e) => handleOfferChange(product.id, offer.uiId, 'packagingDescription', e.target.value)} placeholder="Ex: Caixa com 12 Unid." disabled={isOfferDisabled} />
                                             </div>
                                             <div>
                                               <label htmlFor={`units-${product.id}-${offer.uiId}`} className="block text-xs font-medium text-muted-foreground mb-1">Total Un na Emb. *</label>
                                               <Input id={`units-${product.id}-${offer.uiId}`} type="number" value={offer.unitsInPackaging} onChange={(e) => handleOfferChange(product.id, offer.uiId, 'unitsInPackaging', e.target.value)} placeholder="Ex: 12" disabled={isOfferDisabled} />
                                             </div>
                                             <div>
                                               <label htmlFor={`price-${product.id}-${offer.uiId}`} className="block text-xs font-medium text-muted-foreground mb-1">Preço Total da Emb. (R$) *</label>
                                               <Input
                                                 id={`price-${product.id}-${offer.uiId}`}
                                                 type="text"
                                                 value={offer.totalPackagingPrice > 0 ? formatCurrencyInput(offer.totalPackagingPrice * 100) : ''}
                                                 onChange={(e) => handlePriceChange(product.id, offer.uiId, e.target.value)}
                                                 placeholder="R$ 0,00"
                                                 disabled={isOfferDisabled}
                                               />
                                             </div>
                                             <div className="flex flex-col items-start sm:items-end">
                                                 <label className="block text-xs font-medium text-muted-foreground mb-1 sm:invisible">Preço por Unidade</label>
                                                 <div className="flex items-center justify-between w-full sm:justify-end">
                                                    <span className={`text-md h-10 flex items-center px-3 py-2 rounded-md border ${pricePerUnitClasses}`}>{formatCurrency(pricePerUnit)} / {abbreviateUnit(product.unit)}</span>
                                                 </div>
                                             </div>
                                           </div>
                                           <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
                                             {(isMyOfferOutbid || offer.showBeatOfferOptions) ? (
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
                                                          disabled={Boolean(isButtonDisabled || !offer.unitsInPackaging || Number(offer.unitsInPackaging) <= 0 || (offer.id && !isInEditMode(product.id, offer.uiId)))}
                                                          >
                                                          -{p}%
                                                          </Button>
                                                      ))}
                                                  </div>
                                             ) : (
                                               <div></div> // Placeholder to keep layout consistent
                                             )}
                                             <div className="flex flex-col sm:flex-row gap-2 justify-end">
                                               {offer.id ? (
                                                 // Oferta já confirmada - mostrar "Parar de cotar"
                                                 <Button
                                                   variant="outline"
                                                   size="sm"
                                                   onClick={() => handleStopQuotingClick(product.id, offer.uiId, product.name)}
                                                   disabled={isButtonDisabled}
                                                   className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50 hover:border-destructive"
                                                 >
                                                   <Trash2 className="h-4 w-4 mr-2" />
                                                   Parar de cotar este item
                                                 </Button>
                                               ) : (
                                                 // Oferta não confirmada - mostrar "Remover oferta"
                                                 <Button
                                                   variant="outline"
                                                   size="sm"
                                                   onClick={() => removeOfferField(product.id, offer)}
                                                   disabled={isButtonDisabled}
                                                   className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50 hover:border-destructive"
                                                 >
                                                   {isSaving[savingKey] && offer.id ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                                   Remover Oferta
                                                 </Button>
                                               )}
                                               <Button
                                                 onClick={() => {
                                                   if (offer.id && !isInEditMode(product.id, offer.uiId)) {
                                                     // Se está salva e não está editando, ativar modo edição
                                                     toggleEditMode(product.id, offer.uiId);
                                                   } else {
                                                     // Se está editando ou é nova, salvar
                                                     handleSaveProductOffer(product.id, offer.uiId);
                                                     // Depois de salvar, sair do modo edição
                                                     if (isInEditMode(product.id, offer.uiId)) {
                                                       toggleEditMode(product.id, offer.uiId);
                                                     }
                                                   }
                                                 }}
                                                 disabled={isButtonDisabled || savingOffers.has(savingKey)}
                                                 className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
                                               >
                                                  {isSaving[savingKey] && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                                                  {isQuotationEnded ? 'Prazo Encerrado' :
                                                   !offer.id ? 'Salvar Nova Oferta' :
                                                   !isInEditMode(product.id, offer.uiId) ? 'Editar oferta' : 'Salvar alterações'}
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
                  </TabsContent>
              </Tabs>
            </section>      
      <footer className="mt-8 py-6 border-t" />

      {/* Modal de confirmação para parar de cotar */}
      <AlertDialog open={showStopQuotingModal} onOpenChange={setShowStopQuotingModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Parar de cotar este item?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja parar de cotar &quot;{offerToStop?.productName}&quot;?
              {' '}
              <strong>Esta ação é irreversível</strong> e você não poderá mais fazer ofertas para este item nesta cotação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStopQuoting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, parar de cotar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Nova Marca */}
      <Dialog open={newBrandModal.isOpen} onOpenChange={(open) => !open && closeNewBrandModal()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Propor Nova Marca</DialogTitle>
            <DialogDescription>
              Envie uma proposta de nova marca para &quot;{newBrandModal.productName}&quot;. 
              Ela será enviada ao comprador para aprovação.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="brand-name">Sua Marca Ofertada *</Label>
              <Input
                id="brand-name"
                value={newBrandForm.brandName}
                onChange={(e) => handleNewBrandFormChange('brandName', e.target.value)}
                placeholder="Ex: Maturatta"
                className="text-base"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="packaging-desc">Descrição da Embalagem *</Label>
              <Input
                id="packaging-desc"
                value={newBrandForm.packagingDescription}
                onChange={(e) => handleNewBrandFormChange('packagingDescription', e.target.value)}
                placeholder="Ex: Caixa com 12 Unid."
                className="text-base"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="units-packaging">Total Un na Emb. *</Label>
              <Input
                id="units-packaging"
                type="number"
                value={newBrandForm.unitsInPackaging || ''}
                onChange={(e) => handleNewBrandFormChange('unitsInPackaging', parseInt(e.target.value) || 0)}
                placeholder="Ex: 12"
                className="text-base"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="total-price">Preço Total da Emb. (R$) *</Label>
              <Input
                id="total-price"
                type="text"
                value={newBrandForm.totalPackagingPrice > 0 ? formatCurrencyInput(newBrandForm.totalPackagingPrice * 100) : ''}
                onChange={(e) => {
                  const centavos = parseCurrencyInput(e.target.value);
                  const decimalValue = centavos / 100;
                  handleNewBrandFormChange('totalPackagingPrice', decimalValue);
                }}
                placeholder="R$ 0,00"
                className="text-base"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="brand-image">Imagem da Marca (Opcional)</Label>
              <Input
                id="brand-image"
                type="file"
                accept="image/*"
                onChange={(e) => handleNewBrandFormChange('imageFile', e.target.files?.[0] || null)}
                className="text-base file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              />
              <p className="text-xs text-muted-foreground">
                Envie uma imagem da marca/produto para ajudar na aprovação
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={closeNewBrandModal}
              disabled={isSubmittingNewBrand}
            >
              Cancelar
            </Button>
            <Button 
              onClick={submitNewBrandRequest}
              disabled={isSubmittingNewBrand || !newBrandForm.brandName.trim() || !newBrandForm.packagingDescription.trim() || newBrandForm.unitsInPackaging <= 0 || newBrandForm.totalPackagingPrice <= 0}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isSubmittingNewBrand ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Proposta'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}