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
  HelpCircle,
} from "lucide-react";
import { format, intervalToDuration } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sendOutbidNotification, sendCounterProposalReminder } from "@/actions/notificationActions";
import { closeQuotationAndItems } from "@/actions/quotationActions";
import { formatCurrency } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { voiceMessages } from "@/config/voiceMessages";
import { useSupplierAuth } from "@/hooks/useSupplierAuth";
import SupplierPinModal from "@/components/features/portal/SupplierPinModal";

const QUOTATIONS_COLLECTION = "quotations";
const FORNECEDORES_COLLECTION = "fornecedores";
const SHOPPING_LIST_ITEMS_COLLECTION = "shopping_list_items";
const PENDING_BRAND_REQUESTS_COLLECTION = "pending_brand_requests";

// Utility function to handle preferredBrands as both string and array
const getPreferredBrandsArray = (preferredBrands: string | string[] | undefined): string[] => {
  if (!preferredBrands) return [];
  let brands: string[];
  if (Array.isArray(preferredBrands)) {
    brands = preferredBrands;
  } else {
    brands = preferredBrands.split(',').map(b => b.trim());
  }
  // Filter out brands that are only numbers or empty
  return brands.filter(brand => {
    const trimmed = brand.trim();
    return trimmed.length > 0 && !(/^\d+$/.test(trimmed));
  });
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
  unitWeight?: number;
  totalPackagingPrice?: number;
  isSelf: boolean;
  productUnit: UnitOfMeasure;
}

// Dynamic label and placeholder functions based on product unit
const getDynamicWeightLabel = (unit: string): string => {
  switch (unit) {
    case 'Kilograma(s)':
      return 'Peso (Kg)';
    case 'Litro(s)':
      return 'Volume (ml)';
    case 'Grama(s)':
      return 'Peso (gr)';
    case 'Mililitro(s)':
      return 'Volume (ml)';
    case 'Unidade(s)':
      return 'Qtd por Emb.';
    case 'Pacote(s)':
      return 'Qtd por Emb.';
    default:
      return `Qtd (${abbreviateUnit(unit)})`;
  }
};

const getDynamicWeightPlaceholder = (unit: string): string => {
  switch (unit) {
    case 'Kilograma(s)':
      return 'Ex: 5Kg';
    case 'Litro(s)':
      return 'Ex: 500ml';
    case 'Grama(s)':
      return 'Ex: 250gr';
    case 'Mililitro(s)':
      return 'Ex: 350ml';
    case 'Unidade(s)':
      return 'Ex: 1 unid';
    case 'Pacote(s)':
      return 'Ex: 1 pct';
    default:
      return `Ex: 1 ${abbreviateUnit(unit)}`;
  }
};

const getUnitSuffix = (unit: string): string => {
  switch (unit) {
    case 'Kilograma(s)':
      return 'Kg';
    case 'Litro(s)':
      return 'ml';
    case 'Grama(s)':
      return 'gr';
    case 'Mililitro(s)':
      return 'ml';
    case 'Unidade(s)':
      return 'unid';
    case 'Pacote(s)':
      return 'pct';
    default:
      return abbreviateUnit(unit);
  }
};

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

// Funções para formatação de peso (Kg/L)
const formatWeightInputForKg = (gramas: number): string => {
  const kg = gramas / 1000;
  return kg.toFixed(3).replace('.', ',');
};

const parseWeightInputForKg = (value: string): number => {
  const numbersOnly = value.replace(/[^\d]/g, '');
  return parseInt(numbersOnly) || 0;
};

const handleWeightInputChangeForKg = (value: string): string => {
  const gramas = parseWeightInputForKg(value);
  return formatWeightInputForKg(gramas);
};

// Formatação inteligente de peso para títulos
const formatSmartWeight = (weight: number, unit: UnitOfMeasure | string): string => {
  if ((unit === 'Kilograma(s)' || unit === 'Kg') && weight < 1 && weight > 0) {
    const gramas = Math.round(weight * 1000);
    return `${gramas}g`;
  }
  if ((unit === 'Litro(s)' || unit === 'Lt' || unit === 'L') && weight < 1 && weight > 0) {
    const ml = Math.round(weight * 1000);
    return `${ml}ml`;
  }
  const formattedWeight = weight % 1 === 0 ? weight.toFixed(0) : weight;
  return `${formattedWeight}${abbreviateUnit(unit)}`;
};

const formatPackaging = (quantity: number, weight: number, unit: UnitOfMeasure | string): string => {
  return `${quantity}×${formatSmartWeight(weight, unit)}`;
};

// Gera título dinâmico do produto baseado na oferta do fornecedor
const buildDynamicTitle = (
  productName: string,
  offer: OfferWithUI | undefined,
  productUnit: UnitOfMeasure
): string => {
  if (!offer) return productName;

  let title = productName;

  // Adiciona marca com hífen se preenchida
  if (offer.brandOffered && offer.brandOffered.trim()) {
    title += ` - ${offer.brandOffered}`;
  }

  // Adiciona embalagem se ambos campos preenchidos
  if (offer.unitsInPackaging > 0 && offer.unitWeight && offer.unitWeight > 0) {
    title += ` ${formatPackaging(offer.unitsInPackaging, offer.unitWeight, productUnit)}`;
  }

  // Adiciona preço se preenchido
  if (offer.totalPackagingPrice > 0) {
    title += ` | ${formatCurrency(offer.totalPackagingPrice)}`;
  }

  return title;
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
  const { user: sellerUser } = useAuth();
  const { toast } = useToast();
  const { speak, stop } = useVoiceAssistant();

  const quotationId = params.quotationId as string;
  const supplierId = params.supplierId as string; // ID of the supplier currently viewing the portal

  // PIN Authentication
  const { isAuthenticated, isLoading: authLoading, supplier, showPinModal, verifyPin } = useSupplierAuth(supplierId);

  const { notifications, markAsRead, isLoading: notificationsLoading } = useNotifications({
    targetSupplierId: supplierId,
    quotationId: quotationId,
    isRead: false
  });
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [currentSupplierDetails, setCurrentSupplierDetails] = useState<SupplierType | null>(null);
  const [productsToQuote, setProductsToQuote] = useState<ProductToQuoteVM[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [unseenAlerts, setUnseenAlerts] = useState<string[]>([]);
  const [weightInputValues, setWeightInputValues] = useState<Record<string, string>>({});
  const [expandedProductIds, setExpandedProductIds] = useState<string[]>([]);
  const [showStopQuotingModal, setShowStopQuotingModal] = useState(false);
  const [offerToStop, setOfferToStop] = useState<{productId: string, offerUiId: string, productName: string} | null>(null);
  const [stoppedQuotingProducts, setStoppedQuotingProducts] = useState<Set<string>>(new Set());
  const [editingOffers, setEditingOffers] = useState<Set<string>>(new Set()); // productId_offerUiId
  const [savingOffers, setSavingOffers] = useState<Set<string>>(new Set()); // productId_offerUiId
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("all");
  const [hasSpokenTabMessage, setHasSpokenTabMessage] = useState(false);

  // Estados para o modal de nova marca
  const [newBrandModal, setNewBrandModal] = useState({
    isOpen: false,
    productId: '',
    productName: '',
    productUnit: '' as UnitOfMeasure | ''
  });
  const [newBrandForm, setNewBrandForm] = useState({
    brandName: '',
    packagingDescription: '',
    unitsInPackaging: 0,
    unitWeight: 0,
    totalPackagingPrice: 0,
    imageFile: null as File | null
  });
  const [isSubmittingNewBrand, setIsSubmittingNewBrand] = useState(false);

  // Estado para o passo-a-passo inline
  const [inlineSteps, setInlineSteps] = useState<{
    isActive: boolean;
    productId: string;
    offerUiId: string;
    currentStep: number;
    data: {
      packageType: 'caixa' | 'fardo' | 'granel' | '';
      unitsPerPackage: number;
      unitWeight: number;
      pricePerPackage: number;
      packagesCount: number;
    };
  }>({
    isActive: false,
    productId: '',
    offerUiId: '',
    currentStep: 1,
    data: {
      packageType: '',
      unitsPerPackage: 0,
      unitWeight: 0,
      pricePerPackage: 0,
      packagesCount: 0
    }
  });

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

  // Handlers de narração para o modal de nova marca
  const handleNewBrandBrandNameFocus = () => speak(voiceMessages.formFields.newBrand_brandName_prompt);
  const handleNewBrandPackagingFocus = () => speak(voiceMessages.formFields.newBrand_packaging_prompt);
  const handleNewBrandUnitsFocus = () => speak(voiceMessages.formFields.newBrand_units_prompt);
  const handleNewBrandPriceFocus = () => speak(voiceMessages.formFields.newBrand_price_prompt);
  const handleNewBrandImageFocus = () => speak(voiceMessages.formFields.newBrand_image_prompt);

  // Funções para modal de nova marca
  const openNewBrandModal = (productId: string, productName: string, productUnit: UnitOfMeasure) => {
    setNewBrandModal({
      isOpen: true,
      productId,
      productName,
      productUnit
    });
    setNewBrandForm({
      brandName: '',
      packagingDescription: '',
      unitsInPackaging: 0,
      unitWeight: 0,
      totalPackagingPrice: 0,
      imageFile: null
    });
    speak("Ok, vamos solicitar uma nova marca. Sua sugestão será enviada para o comprador analisar. Preencha os dados do produto e, assim que você enviar, eu avisarei o comprador imediatamente e retornarei com a resposta de aprovação.");
  };

  const closeNewBrandModal = () => {
    setNewBrandModal({
      isOpen: false,
      productId: '',
      productName: '',
      productUnit: '' as UnitOfMeasure | ''
    });
    setNewBrandForm({
      brandName: '',
      packagingDescription: '',
      unitsInPackaging: 0,
      unitWeight: 0,
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

    if (!sellerUser?.uid) {
      toast({ title: "Erro de Autenticação", description: "Seu usuário não foi encontrado. Por favor, recarregue a página.", variant: "destructive" });
      return;
    }

    if (newBrandForm.unitsInPackaging <= 0 || newBrandForm.unitWeight <= 0 || newBrandForm.totalPackagingPrice <= 0) {
      toast({ title: "Erro", description: "Todos os campos são obrigatórios (Unidades > 0, Peso > 0, Preço > 0).", variant: "destructive" });
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
        }
      }

      const pricePerUnit = newBrandForm.totalPackagingPrice / newBrandForm.unitsInPackaging;

      const brandRequestData = {
        quotationId: quotation.id,
        productId: newBrandModal.productId,
        productName: newBrandModal.productName, // Added for notification context
        supplierId: supplierId,
        supplierName: currentSupplierDetails.empresa,
        supplierInitials: currentSupplierDetails.vendedor.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
        brandName: newBrandForm.brandName.trim(),
        packagingDescription: newBrandForm.packagingDescription.trim() || formatPackaging(newBrandForm.unitsInPackaging, newBrandForm.unitWeight, newBrandModal.productUnit),
        unitsInPackaging: newBrandForm.unitsInPackaging,
        unitWeight: newBrandForm.unitWeight,
        totalPackagingPrice: newBrandForm.totalPackagingPrice,
        pricePerUnit: pricePerUnit,
        imageUrl: imageUrl,
        imageFileName: newBrandForm.imageFile?.name || '',
        buyerUserId: quotation.userId, // ID do comprador
        sellerUserId: sellerUser?.uid || supplierId, // ID do vendedor (usa supplierId se não autenticado)
      };

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

      speak(voiceMessages.success.brandRequestSent);

      closeNewBrandModal();

    } catch (error: any) {
      console.error("Error submitting brand request:", error);
      
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
    } finally {
      setIsSubmittingNewBrand(false);
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

  // Effect for handling priority notifications and welcome speech
  useEffect(() => {
    if (isLoading || notificationsLoading || hasSpokenTabMessage || !productsToQuote.length || !currentSupplierDetails) {
        return;
    }

    const brandApprovalNotification = notifications.find(n => n.type === 'brand_approval_approved');
    const brandRejectionNotification = notifications.find(n => n.type === 'brand_approval_rejected');

    if (brandApprovalNotification) {
        speak(voiceMessages.actions.brandApproved(brandApprovalNotification.brandName || ''));
        markAsRead(brandApprovalNotification.id);
        setHasSpokenTabMessage(true);
    } else if (brandRejectionNotification) {
        speak(voiceMessages.actions.brandRejected(brandRejectionNotification.brandName || ''));
        markAsRead(brandRejectionNotification.id);
        setHasSpokenTabMessage(true);
    } else {
        // If no priority message was spoken, speak the normal welcome message
        const supplierName = currentSupplierDetails.empresa?.split(' ')[0] || 'Fornecedor';
        const itemCount = productsToQuote.length;
        speak(voiceMessages.welcome.quotationPage(supplierName, itemCount));
        setHasSpokenTabMessage(true);
    }
  }, [isLoading, notificationsLoading, hasSpokenTabMessage, notifications, productsToQuote, currentSupplierDetails, markAsRead, speak]);

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
        const snapshotStartTime = performance.now();
        console.log('[LISTENER] Offers snapshot received for product:', product.id, 'docs:', offersSnapshot.docs.length);
        const offersData = offersSnapshot.docs.map(doc => ({ ...doc.data() as Offer, id: doc.id, uiId: doc.id }));

        // Fetch new supplier details
        const fetchStartTime = performance.now();
        const newSupplierIdsToFetch = new Set<string>();
        offersData.forEach(offer => {
          if (offer.supplierId && !supplierDetailsCache.current.has(offer.supplierId)) {
            newSupplierIdsToFetch.add(offer.supplierId);
          }
        });

        if (newSupplierIdsToFetch.size > 0) {
          console.log('[LISTENER] Fetching supplier details for:', Array.from(newSupplierIdsToFetch));
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
          const fetchEndTime = performance.now();
          console.log(`[LISTENER] Supplier fetch took ${(fetchEndTime - fetchStartTime).toFixed(2)}ms`);
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
        const myOfferBrands = new Set<string>();

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
              unitWeight: bestOffer.unitWeight,
              totalPackagingPrice: bestOffer.totalPackagingPrice,
              isSelf: bestOffer.supplierId === supplierId,
              productUnit: product.unit,
            });

            if (bestOffer.supplierId === supplierId) {
              myOfferBrands.add(brandName);
            }
          }

          // If my offer is not the best for this brand, add it separately
          const myOfferForBrand = offers.find(o => o.supplierId === supplierId);

          if (myOfferForBrand && myOfferForBrand.id !== bestOffer.id) {
            const mySupplierDetails = supplierDetailsCache.current.get(supplierId);
            if (mySupplierDetails) {
              brandDisplays.push({
                brandName,
                pricePerUnit: myOfferForBrand.pricePerUnit,
                supplierId,
                supplierName: mySupplierDetails.empresa,
                supplierInitials: mySupplierDetails.empresa.substring(0, 2).toUpperCase(),
                supplierFotoUrl: mySupplierDetails.fotoUrl,
                supplierFotoHint: mySupplierDetails.fotoHint,
                vendedor: mySupplierDetails.vendedor,
                cnpj: mySupplierDetails.cnpj,
                packagingDescription: myOfferForBrand.packagingDescription,
                unitsInPackaging: myOfferForBrand.unitsInPackaging,
                unitWeight: myOfferForBrand.unitWeight,
                totalPackagingPrice: myOfferForBrand.totalPackagingPrice,
                isSelf: true,
                productUnit: product.unit,
              });
              myOfferBrands.add(brandName);
            }
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

              // Check if there are multiple competing suppliers (not just first offer)
              const competingSuppliersCount = new Set(offersData.filter(o => o.pricePerUnit > 0).map(o => o.supplierId)).size;

              // Check if main quotation is still open
              const isQuotationOpen = quotation.status === 'Aberta' && quotation.deadline && new Date() < quotation.deadline.toDate();

              if (new Date() < deadline) {
                counterProposalInfo = {
                  deadline,
                  winningBrand: outbidOffer.brandOffered,
                  myBrand: myBestOffer.brandOffered,
                };
              } else if (competingSuppliersCount > 1 && !isQuotationOpen) {
                // Only lock out if there are competing offers AND main quotation is closed
                isLockedOut = true;
              }
            }
          }
        }

        // Update the specific product
        console.log('[LISTENER] Processing product update for:', product.id);
        const listenerStartTime = performance.now();
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
        const listenerEndTime = performance.now();
        const totalListenerTime = listenerEndTime - snapshotStartTime;
        console.log(`[LISTENER] setState took ${(listenerEndTime - listenerStartTime).toFixed(2)}ms`);
        console.log(`[LISTENER] Total listener time for ${product.id}: ${totalListenerTime.toFixed(2)}ms`);
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

  // Effect for voice narration when user actively changes tabs
  useEffect(() => {
    if (hasSpokenTabMessage) {
      const tabMessages: Record<string, string> = {
        all: voiceMessages.tabs.all,
        obrigatorios: voiceMessages.tabs.required,
        opcionais: voiceMessages.tabs.optional,
        enviados: voiceMessages.tabs.sent,
      };

      const message = tabMessages[activeCategoryTab];
      if (message) {
        speak(message);
      }
    }
  }, [activeCategoryTab, hasSpokenTabMessage, speak]);

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
    const wasExpanded = expandedProductIds.includes(productId);

    if (wasExpanded) {
      stop(); // Interrompe a fala se o card estiver sendo fechado
    }

    setExpandedProductIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [productId]
    );

    // Narração ao expandir (não ao colapsar)
    if (!wasExpanded) {
      const product = productsToQuote.find(p => p.id === productId);
      if (product) {
        // Verifica se já tem ofertas salvas do fornecedor atual
        const myOffers = product.supplierOffers.filter(o => o.id && o.supplierId === supplierId);

        if (myOffers.length > 0) {
          // Já tem oferta(s) enviada(s)
          const hasMultipleOffers = myOffers.length > 1;

          // Verifica se está ganhando ou perdendo
          const myBestPrice = Math.min(...myOffers.map(o => o.pricePerUnit));
          const competitorBestOffer = product.bestOffersByBrand.find(b => !b.isSelf);

          const isWinning = !competitorBestOffer || myBestPrice < competitorBestOffer.pricePerUnit;
          const competitorPriceStr = competitorBestOffer
            ? formatCurrency(competitorBestOffer.pricePerUnit)
            : undefined;

          speak(voiceMessages.actions.itemExpandedWithOffer(
            product.name,
            hasMultipleOffers,
            isWinning,
            competitorPriceStr
          ));
        } else {
          // Ainda não tem oferta enviada
          const hasDeliveryMismatch = Boolean(product.hasSpecificDate && product.isDeliveryDayMismatch);
          speak(voiceMessages.actions.itemExpanded(product.name, hasDeliveryMismatch));
        }
      }
    }
  };

  const handleOfferChange = (productId: string, offerUiId: string, field: keyof OfferWithUI, value: string | number | boolean) => {
    console.log('[OFFER_CHANGE] Called with:', { productId, offerUiId, field, value });
    const startTime = performance.now();
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
    const endTime = performance.now();
    console.log(`[OFFER_CHANGE] Completed in ${(endTime - startTime).toFixed(2)}ms`);
  };

  // Handlers de narração para campos do formulário
  const handlePackagingDescriptionBlur = (productId: string, offerUiId: string) => {
    const product = productsToQuote.find(p => p.id === productId);
    const offer = product?.supplierOffers.find(o => o.uiId === offerUiId);
    if (offer && offer.packagingDescription.trim()) {
      speak(voiceMessages.formFields.packagingDescriptionFilled);
    }
  };

  const handleUnitsInPackagingFocus = (productId: string) => {
    const product = productsToQuote.find(p => p.id === productId);
    if (product) {
      speak(voiceMessages.formFields.unitsInPackagingPrompt(product.unit, product.name || ''));
    }
  };

  const handleUnitsInPackagingBlur = () => {
    speak(voiceMessages.formFields.unitsInPackagingFilled);
  };

  const handlePriceFocus = (productId: string) => {
    const product = productsToQuote.find(p => p.id === productId);
    if (product) {
      speak(voiceMessages.formFields.pricePrompt(product.unit));
    }
  };

  const handlePriceBlur = (productId: string, offerUiId: string) => {
    const product = productsToQuote.find(p => p.id === productId);
    const offer = product?.supplierOffers.find(o => o.uiId === offerUiId);
    if (offer && product && offer.totalPackagingPrice > 0) {
      const priceFormatted = formatCurrency(offer.totalPackagingPrice);
      speak(voiceMessages.formFields.priceFilled(product.name, offer.brandOffered, priceFormatted, product.unit));
    }
  };

  const handlePriceChange = (productId: string, offerUiId: string, inputValue: string) => {
    // Parse centavos do input formatado
    const centavos = parseCurrencyInput(inputValue);
    // Converte para valor decimal para armazenamento
    const decimalValue = centavos / 100;
    // Atualiza o estado com o valor decimal
    handleOfferChange(productId, offerUiId, 'totalPackagingPrice', decimalValue);
  };

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>, product: ProductToQuoteVM, offer: OfferWithUI) => {
    const inputValue = e.target.value;
    const key = `${product.id}_${offer.uiId}`;

    // Para Kg e Litros: usuário digita em gramas/ml, sistema converte para Kg/L
    if (product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)') {
      const gramas = parseWeightInputForKg(inputValue);
      const kg = gramas / 1000;

      // Atualiza o display value (formatado com vírgula)
      const formattedValue = formatWeightInputForKg(gramas);
      setWeightInputValues(prev => ({ ...prev, [key]: formattedValue }));

      // Atualiza o valor real em Kg/L
      handleOfferChange(product.id, offer.uiId, 'unitWeight', kg);
    } else {
      // Para outras unidades: valor direto
      const numericValue = parseFloat(inputValue.replace(',', '.')) || 0;
      handleOfferChange(product.id, offer.uiId, 'unitWeight', numericValue);
    }
  };

  const getWeightDisplayValue = (product: ProductToQuoteVM, offer: OfferWithUI): string => {
    const key = `${product.id}_${offer.uiId}`;

    // Para Kg/L: usa o valor formatado do state
    if (product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)') {
      if (weightInputValues[key] !== undefined) {
        return weightInputValues[key];
      }
      // Valor inicial: converte Kg para gramas e formata
      if (offer.unitWeight) {
        const gramas = Math.round(offer.unitWeight * 1000);
        return formatWeightInputForKg(gramas);
      }
      return '0,000';
    }

    // Para outras unidades: valor direto
    return offer.unitWeight?.toString().replace('.', ',') || '';
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

    // Prevent duplicate execution
    const executionKey = `addOffer-${productId}-${brandToPreFill}-${isSuggested}`;
    if (lastClickRef.current?.action === executionKey && Date.now() - lastClickRef.current.timestamp < 500) {
      return;
    }
    lastClickRef.current = { action: executionKey, timestamp: Date.now() };

    if (!currentSupplierDetails) {
        toast({title: "Erro", description: "Dados do fornecedor não carregados.", variant: "destructive"});
        return;
    }

    if (!expandedProductIds.includes(productId)) {
      setExpandedProductIds(prev => [...prev, productId]);
    }

    const newOfferUiId = Date.now().toString() + Math.random().toString(36).substring(2,7);

    setProductsToQuote(prevProducts => {
      const targetProduct = prevProducts.find(p => p.id === productId);
      if (targetProduct) {
      }
      const updatedProducts = prevProducts.map(p => {
        if (p.id === productId) {
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

            const updatedProduct = {
                ...p,
                supplierOffers: [...p.supplierOffers, newOffer],
            };
             // Don't auto-focus for suggested brands - they should appear pre-filled but not editable
             if (!brandToPreFill) {
               setTimeout(() => {
                  const brandInputRef = brandInputRefs.current[`${productId}_${newOfferUiId}`];
                  brandInputRef?.focus();
              }, 0);
             } else {
             }
            return updatedProduct;
        }
        return p;
      });
      return updatedProducts;
    });
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

    if (lastClickRef.current?.action === actionKey && now - lastClickRef.current.timestamp < 300) {
      return;
    }
    lastClickRef.current = { action: actionKey, timestamp: now };

    const product = productsToQuote.find(p => p.id === productId);
    if (!product) return;

    const unsavedOfferIndex = product.supplierOffers.findIndex(o => !o.id);

    if (unsavedOfferIndex !== -1) {
        // There is an unsaved offer, so update it.
        const currentOffer = product.supplierOffers[unsavedOfferIndex];
        // Update both the brand name and mark as suggested brand
        const offerUiId = product.supplierOffers[unsavedOfferIndex].uiId;

        // Prevent double execution using useCallback-like pattern
        const stateUpdateKey = `updateBrand-${productId}-${offerUiId}-${brandName}`;
        if (lastClickRef.current?.action === stateUpdateKey && Date.now() - lastClickRef.current.timestamp < 200) {
          return;
        }
        lastClickRef.current = { action: stateUpdateKey, timestamp: Date.now() };

        setProductsToQuote(prevProducts => {
          const result = prevProducts.map(p => {
            if (p.id === productId) {
              const updatedOffers = p.supplierOffers.map(offer => {
                if (offer.uiId === offerUiId) {
                  const updatedOffer = {
                    ...offer,
                    brandOffered: brandName,
                    isSuggestedBrand: true
                  };
                  return updatedOffer;
                }
                return offer;
              });
              return { ...p, supplierOffers: updatedOffers };
            }
            return p;
          });
          return result;
        });

        // Narração após selecionar marca
        speak(voiceMessages.actions.brandSelected(brandName, product.unit));
    } else {
        // There are no unsaved offers, so add a new one.
        addOfferField(productId, brandName, true); // Mark as suggested brand so it's non-editable

        // Narração após selecionar marca
        speak(voiceMessages.actions.brandSelected(brandName, product.unit));
    }
  };

  const handleOtherBrandClick = (productId: string) => {
    // Debounce rapid clicks
    const now = Date.now();
    const actionKey = `other-${productId}`;

    if (lastClickRef.current?.action === actionKey && now - lastClickRef.current.timestamp < 300) {
      return;
    }
    lastClickRef.current = { action: actionKey, timestamp: now };

    const product = productsToQuote.find(p => p.id === productId);
    if (!product) return;

    const unsavedOfferIndex = product.supplierOffers.findIndex(o => !o.id);

    if (unsavedOfferIndex === -1) {
        // Only add a new field if there are no unsaved offers
        addOfferField(productId, '', false);
    } else {
        // Convert existing unsaved offer to "other brand" (clear brand and make editable)
        const currentOffer = product.supplierOffers[unsavedOfferIndex];

        // Prevent double execution
        const conversionKey = `convertOther-${productId}-${currentOffer.uiId}`;
        if (lastClickRef.current?.action === conversionKey && Date.now() - lastClickRef.current.timestamp < 200) {
          return;
        }
        lastClickRef.current = { action: conversionKey, timestamp: Date.now() };

        setProductsToQuote(prevProducts => {
          const result = prevProducts.map(p => {
            if (p.id === productId) {
              const updatedOffers = [...p.supplierOffers];
              const originalOffer = updatedOffers[unsavedOfferIndex];
              updatedOffers[unsavedOfferIndex] = {
                ...originalOffer,
                brandOffered: '',
                isSuggestedBrand: false
              };
              return { ...p, supplierOffers: updatedOffers };
            }
            return p;
          });
          return result;
        });
    }
  };

  const isFirstOfferForProduct = useCallback((productId: string) => {
    const product = productsToQuote.find(p => p.id === productId);
    return !product || product.supplierOffers.length === 0;
  }, [productsToQuote]);

  const calculatePricePerUnit = (offer: OfferWithUI | Partial<OfferWithUI>): number | null => {
    const units = Number(offer.unitsInPackaging);
    const price = Number(offer.totalPackagingPrice);
    if (!isNaN(units) && !isNaN(price) && units > 0 && price > 0) {
      return price / units;
    }
    return null;
  };

  const handleSaveProductOffer = async (productId: string, offerUiId: string): Promise<boolean> => {
    const totalStartTime = performance.now();
    console.log('[SAVE] Starting handleSaveProductOffer', productId, offerUiId);
    // Debounce rapid save clicks
    const now = Date.now();
    const actionKey = `save-${productId}-${offerUiId}`;
    if (lastClickRef.current?.action === actionKey && now - lastClickRef.current.timestamp < 1000) {
      console.log('[SAVE] Debounced - too soon');
      return false;
    }
    lastClickRef.current = { action: actionKey, timestamp: now };

    if (!currentSupplierDetails || !quotation || !quotation.userId) {
        console.log('[SAVE] Missing supplier/quotation data');
        toast({title: "Erro Interno", description: "Dados do fornecedor, cotação ou ID do comprador ausentes.", variant: "destructive"});
        return false;
    }
    const product = productsToQuote.find(p => p.id === productId);
    if (!product) {
      console.log('[SAVE] Product not found');
      return false;
    }

    const offerToSaveIndex = product.supplierOffers.findIndex(o => o.uiId === offerUiId);
    if (offerToSaveIndex === -1) {
        toast({title: "Erro", description: "Oferta não encontrada para salvar.", variant: "destructive"});
        return false;
    }
    const offerData = product.supplierOffers[offerToSaveIndex];

    const unitsInPackaging = Number(offerData.unitsInPackaging);
    const unitWeight = Number(offerData.unitWeight);
    const totalPackagingPrice = Number(offerData.totalPackagingPrice);

    console.log('[SAVE] Validation:', { unitsInPackaging, unitWeight, totalPackagingPrice });

    if (isNaN(unitsInPackaging) || unitsInPackaging <= 0 || isNaN(unitWeight) || unitWeight <= 0 || isNaN(totalPackagingPrice) || totalPackagingPrice <= 0) {
      console.log('[SAVE] Validation failed');
      toast({title: "Dados Inválidos", description: "Preencha todos os campos da oferta corretamente (Unidades > 0, Peso > 0, Preço > 0).", variant: "destructive", duration: 7e3});
      return false;
    }

    const pricePerUnit = totalPackagingPrice / unitsInPackaging;
    console.log('[SAVE] Price per unit:', pricePerUnit);

    const bestCompetitorOffer = product.bestOffersByBrand.find(o => o.supplierId !== supplierId);

    if (bestCompetitorOffer && pricePerUnit < bestCompetitorOffer.pricePerUnit && pricePerUnit > bestCompetitorOffer.pricePerUnit * 0.99) {
        toast({
            title: "Oferta Inválida",
            description: `Sua oferta deve ser pelo menos 1% menor que a melhor oferta atual de ${formatCurrency(bestCompetitorOffer.pricePerUnit)}. O valor mínimo para cobrir esta oferta é de ${formatCurrency(bestCompetitorOffer.pricePerUnit * 0.99)}. `,
            variant: "destructive",
        });
        return false;
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
        return false;
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
      unitWeight,
      totalPackagingPrice,
      pricePerUnit,
      updatedAt: serverTimestamp() as Timestamp,
      productId: productId,
    };
    
    const savingKey = `${productId}_${offerUiId}`;
    console.log('[SAVE] Setting saving state to true');
    setIsSaving(prev => ({ ...prev, [savingKey]: true }));
    // Adiciona a oferta à lista de ofertas sendo salvas
    setSavingOffers(prev => new Set(prev).add(savingKey));

    try {
      if (offerData.id) {
        console.log('[SAVE] Updating existing offer:', offerData.id);
        const offerRef = doc(db, `quotations/${quotationId}/products/${productId}/offers/${offerData.id}`);
        await updateDoc(offerRef, offerPayload);
        console.log('[SAVE] Update complete');
        toast({ title: "Oferta Atualizada!", description: `Sua oferta para ${product.name} (${offerData.brandOffered}) foi atualizada.` });
        speak(voiceMessages.success.offerSaved);
      } else {
        console.log('[SAVE] Creating new offer, skipping duplicate check for performance');
        // Skip duplicate check for better performance - Firebase will handle uniqueness with IDs

        console.log('[SAVE] Adding new offer to Firestore');
        const addDocStartTime = performance.now();
        const offerCollectionRef = collection(db, `quotations/${quotationId}/products/${productId}/offers`);
        const newOfferDocRef = await addDoc(offerCollectionRef, offerPayload);
        const addDocEndTime = performance.now();
        console.log(`[SAVE] Add complete, doc ID: ${newOfferDocRef.id}, addDoc took ${(addDocEndTime - addDocStartTime).toFixed(2)}ms`);

        const toastStartTime = performance.now();
        toast({ title: "Oferta Salva!", description: `Sua oferta para ${product.name} (${offerData.brandOffered}) foi salva.` });
        const toastEndTime = performance.now();
        console.log(`[SAVE] Toast took ${(toastEndTime - toastStartTime).toFixed(2)}ms`);

        const speakStartTime = performance.now();
        // Make speak non-blocking by deferring it
        setTimeout(() => speak(voiceMessages.success.offerSaved), 0);
        const speakEndTime = performance.now();
        console.log(`[SAVE] Speak took ${(speakEndTime - speakStartTime).toFixed(2)}ms`);
      }

      const clearingStartTime = performance.now();
      console.log('[SAVE] Clearing alerts and flags');
      
      const alertsStartTime = performance.now();
      setUnseenAlerts(prev => prev.filter(alertId => alertId !== productId));
      const alertsEndTime = performance.now();
      console.log(`[SAVE] setUnseenAlerts took ${(alertsEndTime - alertsStartTime).toFixed(2)}ms`);
      
      const offerChangeStartTime = performance.now();
      handleOfferChange(productId, offerUiId, 'showBeatOfferOptions', false); // Reset the flag after saving
      const offerChangeEndTime = performance.now();
      console.log(`[SAVE] handleOfferChange took ${(offerChangeEndTime - offerChangeStartTime).toFixed(2)}ms`);

      const totalEndTime = performance.now();
      console.log(`[SAVE] Save complete in ${(totalEndTime - totalStartTime).toFixed(2)}ms, returning true`);
      return true;
    } catch (error: any) {
      console.log('[SAVE] Error:', error);
      toast({ title: "Erro ao Salvar Oferta", description: error.message, variant: "destructive" });
      setTimeout(() => speak(voiceMessages.error.saveFailed), 0);
      return false;
    } finally {
      setIsSaving(prev => ({ ...prev, [savingKey]: false }));
      // Remove a oferta da lista de ofertas sendo salvas
      setSavingOffers(prev => {
        const newSet = new Set(prev);
        newSet.delete(savingKey);
        return newSet;
      });
      const totalEndTime = performance.now();
      console.log(`[SAVE] Finally block completed, total time: ${(totalEndTime - totalStartTime).toFixed(2)}ms`);
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

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Carregando...</p>
      </div>
    );
  }

  // Show PIN modal if not authenticated
  if (showPinModal && supplier) {
    return (
      <SupplierPinModal
        isOpen={true}
        supplierName={supplier.empresa}
        onVerify={verifyPin}
      />
    );
  }

  // Block access if not authenticated (and supplier has PIN)
  if (!isAuthenticated && supplier?.pin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Aguardando autenticação...</p>
      </div>
    );
  }

  // If supplier has no PIN, allow access (backward compatibility)
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
                <TabsContent value={activeCategoryTab} className="space-y-8">
                  {filteredProducts.length === 0 && !isLoading ? (
                      <Card><CardContent className="p-6 text-center"><p className="text-muted-foreground">Nenhum item encontrado nesta categoria.</p></CardContent></Card>
                  ) : (
                    <div className="space-y-8">
                      {filteredProducts.map((product, index) => {
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
                      <Card key={product.id} className={`border-2 transition-all duration-300 ${
                          isMyOfferWinning ? 'animate-pulse-glow-green' :
                          isMyOfferLosing ? 'animate-pulse-glow-red' :
                          hasUnseenAlert ? 'border-orange-500 shadow-lg' : 
                          isExpanded ? 'border-blue-500 shadow-lg bg-gradient-to-r from-blue-50/30 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/20' : 'border-transparent'
                      }`}>                  <CardHeader className="bg-muted/30 p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleProductExpansion(product.id)}>
                            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                <div className="flex items-center gap-3 flex-grow">

                                    <div>
                                        <h3 className="text-xl font-semibold">
                                          {(() => {
                                            // Pega a oferta em andamento (não salva) ou a última oferta do fornecedor
                                            const myOfferInProgress = product.supplierOffers.find(o => o.supplierId === supplierId && !o.id);
                                            const myLastOffer = product.supplierOffers.filter(o => o.supplierId === supplierId).sort((a, b) => {
                                              if (a.updatedAt instanceof Timestamp && b.updatedAt instanceof Timestamp) {
                                                return b.updatedAt.toMillis() - a.updatedAt.toMillis();
                                              }
                                              return 0;
                                            })[0];
                                            const offerToShow = myOfferInProgress || myLastOffer;
                                            return buildDynamicTitle(product.name, offerToShow, product.unit);
                                          })()}
                                        </h3>
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
                                  <div className="flex flex-row flex-wrap gap-6 p-3">
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
                                              <div key={offer.brandName + offer.supplierId} className={`flex items-start justify-between p-3 rounded-md bg-muted/20 border-l-4 min-w-[280px] gap-3 ${variantClasses}`}>
                                                  <div className="flex items-start gap-3 flex-1">
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
                                                      <div className="flex-1">
                                                          <div className="mb-1">
                                                            <h4 className="text-base font-semibold text-foreground" title={offer.brandName}>
                                                              {offer.brandName}
                                                              {offer.unitsInPackaging && offer.unitWeight && (
                                                                <span className="text-sm text-muted-foreground font-normal">
                                                                  {` - ${formatPackaging(offer.unitsInPackaging, offer.unitWeight, offer.productUnit)}`}
                                                                </span>
                                                              )}
                                                              {offer.totalPackagingPrice && offer.totalPackagingPrice > 0 && (
                                                                <span className="text-sm text-muted-foreground font-normal">
                                                                  {` | ${formatCurrency(offer.totalPackagingPrice)}`}
                                                                </span>
                                                              )}
                                                            </h4>
                                                          </div>
                                                          <p className="text-xs text-muted-foreground">por {offer.supplierName}</p>
                                                      </div>
                                                  </div>
                                                  <div className="text-right shrink-0">
                                                      <p className={`text-base font-bold leading-tight ${textPriceClass}`}>
                                                        {formatCurrency(offer.pricePerUnit)} / {abbreviateUnit(offer.productUnit)}
                                                      </p>
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
                                          <div key={request.id} className="flex items-start justify-between p-3 rounded-md bg-orange-50/50 border-l-4 border-orange-500 min-w-[280px] gap-3">
                                              <div className="flex items-start gap-3 flex-1">
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
                                                  <div className="flex-1">
                                                      <div className="mb-1">
                                                        <h4 className="text-base font-semibold text-foreground" title={request.brandName}>
                                                          {request.brandName}
                                                          {request.unitsInPackaging && request.unitWeight && (
                                                            <span className="text-sm text-muted-foreground font-normal">
                                                              {` - ${formatPackaging(request.unitsInPackaging, request.unitWeight, product.unit)}`}
                                                            </span>
                                                          )}
                                                          {request.totalPackagingPrice && request.totalPackagingPrice > 0 && (
                                                            <span className="text-sm text-muted-foreground font-normal">
                                                              {` | ${formatCurrency(request.totalPackagingPrice)}`}
                                                            </span>
                                                          )}
                                                        </h4>
                                                      </div>
                                                      <p className="text-xs text-muted-foreground">por {request.supplierName}</p>
                                                  </div>
                                              </div>
                                              <div className="text-right shrink-0">
                                                  <p className="text-base font-bold text-orange-600 leading-tight">{formatCurrency(request.pricePerUnit)} / {abbreviateUnit(product.unit)}</p>
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
      
                                     {/* Assistente para produtos sem ofertas */}
                                     {isFirstOfferForProduct(product.id) && (
                                       <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                         <div className="flex items-center justify-between">
                                           <div>
                                             <h4 className="text-sm font-medium text-blue-900">🧙‍♂️ Primeira vez cotando este item?</h4>
                                             <p className="text-xs text-blue-700 mt-1">Use nosso assistente para facilitar o preenchimento.</p>
                                           </div>
                                           <button
                                             onClick={() => alert('Assistente será implementado em breve!')}
                                             className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
                                           >
                                             🚀 Em Breve
                                           </button>
                                         </div>
                                       </div>
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
                                          onClick={() => !isLockedOut && openNewBrandModal(product.id, product.name, product.unit)} 
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
                                           <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-2 items-end">
                                               <div className="space-y-1">
                                               <div className="flex items-center gap-1">
                                                 <label htmlFor={`units-${product.id}-${offer.uiId}`} className="block text-xs font-medium text-muted-foreground">Quantas Cx ou fardos vc irá enviar *</label>
                                                 <button
                                                   type="button"
                                                   onClick={() => speak("Digite quantas caixas ou fardos você irá enviar para o comprador")}
                                                   className="text-muted-foreground hover:text-primary transition-colors"
                                                   title="Ajuda sobre este campo"
                                                   tabIndex={-1}
                                                 >
                                                   <HelpCircle className="h-3.5 w-3.5" />
                                                 </button>
                                               </div>
                                               <Input
                                                 id={`units-${product.id}-${offer.uiId}`}
                                                 type="number"
                                                 value={offer.unitsInPackaging > 0 ? offer.unitsInPackaging : ''}
                                                 onChange={(e) => handleOfferChange(product.id, offer.uiId, 'unitsInPackaging', e.target.value)}
                                                 placeholder="Ex: 5"
                                                 disabled={isOfferDisabled}
                                                 className="w-full"
                                               />
                                             </div>
                                             
                                             <div className="space-y-1">
                                               <div className="flex items-center gap-1">
                                                 <label htmlFor={`brand-${product.id}-${offer.uiId}`} className="block text-xs font-medium text-muted-foreground">Total Un na Emb. *</label>
                                                 <button
                                                   type="button"
                                                   onClick={() => speak("Digite quantas unidades vêm dentro de cada caixa ou fardo")}
                                                   className="text-muted-foreground hover:text-primary transition-colors"
                                                   title="Ajuda sobre este campo"
                                                   tabIndex={-1}
                                                 >
                                                   <HelpCircle className="h-3.5 w-3.5" />
                                                 </button>
                                               </div>
                                               <Input
                                                 id={`brand-${product.id}-${offer.uiId}`}
                                                 type="number"
                                                 value={offer.unitsPerPackage || ''}
                                                 onChange={(e) => handleOfferChange(product.id, offer.uiId, 'unitsPerPackage', e.target.value)}
                                                 placeholder="Ex: 12"
                                                 disabled={isOfferDisabled}
                                                 className="w-full"
                                               />
                                             </div>
                                             
                                            <div className="flex-1 min-w-[140px]">
                                              <div className="flex items-center gap-1 mb-1">
                                                <label htmlFor={`weight-${product.id}-${offer.uiId}`} className="block text-xs font-medium text-muted-foreground">
                                                  {getDynamicWeightLabel(product.unit)} *
                                                </label>
                                                <button
                                                  type="button"
                                                  onClick={() => speak(product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)'
                                                    ? `Digite o peso em ${product.unit === 'Kilograma(s)' ? 'gramas' : 'mililitros'}. O sistema converte automaticamente para ${product.unit === 'Kilograma(s)' ? 'quilogramas' : 'litros'}.`
                                                    : `Digite o peso unitário em ${product.unit}.`
                                                  )}
                                                  className="text-muted-foreground hover:text-primary transition-colors"
                                                  title="Ajuda sobre este campo"
                                                  tabIndex={-1}
                                                >
                                                  <HelpCircle className="h-3.5 w-3.5" />
                                                </button>
                                              </div>
                                              <div className="relative">
                                                <Input
                                                  id={`weight-${product.id}-${offer.uiId}`}
                                                  type={product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)' ? "text" : "number"}
                                                  value={getWeightDisplayValue(product, offer)}
                                                  onChange={(e) => handleWeightChange(e, product, offer)}
                                                  placeholder={getDynamicWeightPlaceholder(product.unit)}
                                                  step={product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)' || product.unit === 'Grama(s)' || product.unit === 'Mililitro(s)' ? "1" : "0.01"}
                                                  disabled={isOfferDisabled}
                                                  className="pr-12"
                                                />
                                                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                                                  {getUnitSuffix(product.unit)}
                                                </span>
                                              </div>
                                            </div>
                                             <div className="flex-1 min-w-[140px]">
                                               <div className="flex items-center gap-1 mb-1">
                                                 <label htmlFor={`price-${product.id}-${offer.uiId}`} className="block text-xs font-medium text-muted-foreground">Preço Total da Emb. (R$) *</label>
                                                 <button
                                                   type="button"
                                                   onClick={() => speak(voiceMessages.formFields.priceHelp(product.unit))}
                                                   className="text-muted-foreground hover:text-primary transition-colors"
                                                   title="Ajuda sobre este campo"
                                                   tabIndex={-1}
                                                 >
                                                   <HelpCircle className="h-3.5 w-3.5" />
                                                 </button>
                                               </div>
                                               <Input
                                                 id={`price-${product.id}-${offer.uiId}`}
                                                 type="text"
                                                 value={offer.totalPackagingPrice > 0 ? formatCurrencyInput(offer.totalPackagingPrice * 100) : ''}
                                                 onChange={(e) => handlePriceChange(product.id, offer.uiId, e.target.value)}
                                                 onFocus={() => handlePriceFocus(product.id)}
                                                 onBlur={() => handlePriceBlur(product.id, offer.uiId)}
                                                 placeholder="R$ 0,00"
                                                 disabled={isOfferDisabled}
                                               />
                                             </div>
                                             <div className="flex-1 min-w-[120px] flex flex-col">
                                                 <label className="block text-xs font-medium text-muted-foreground mb-1 lg:invisible">Preço/Unid.</label>
                                                 <div className="flex items-center justify-start lg:justify-end h-10">
                                                    <span className={`text-sm flex items-center px-3 py-2 rounded-md border ${pricePerUnitClasses}`}>{formatCurrency(pricePerUnit)} / {abbreviateUnit(product.unit)}</span>
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
                                                 onClick={async () => {
                                                   if (offer.id && !isInEditMode(product.id, offer.uiId)) {
                                                     // Se está salva e não está editando, ativar modo edição
                                                     toggleEditMode(product.id, offer.uiId);
                                                   } else {
                                                     // Se está editando ou é nova, salvar
                                                     const success = await handleSaveProductOffer(product.id, offer.uiId);
                                                     // Depois de salvar com sucesso, sair do modo edição
                                                     if (success && isInEditMode(product.id, offer.uiId)) {
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
                    </div>
                  )}
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
              <Label htmlFor="brand-name">Nome da Marca *</Label>
              <Input
                id="brand-name"
                type="text"
                value={newBrandForm.brandName}
                onChange={(e) => handleNewBrandFormChange('brandName', e.target.value)}
                onFocus={handleNewBrandBrandNameFocus}
                placeholder="Ex: Marca Nova"
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
                onFocus={handleNewBrandUnitsFocus}
                placeholder="Ex: 12"
                className="text-base"
              />
            </div>

            {/* X separator between fields */}
            <div className="flex items-center justify-center">
              <span className="text-2xl font-bold text-muted-foreground">×</span>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="unit-weight-modal">
                {getDynamicWeightLabel(newBrandModal.productUnit)} *
              </Label>
              <div className="relative">
                <Input
                  id="unit-weight-modal"
                  type={newBrandModal.productUnit === 'Kilograma(s)' || newBrandModal.productUnit === 'Litro(s)' ? "text" : "number"}
                  value={
                    newBrandModal.productUnit === 'Kilograma(s)' || newBrandModal.productUnit === 'Litro(s)'
                      ? (newBrandForm.unitWeight > 0 ? formatWeightInputForKg(newBrandForm.unitWeight * 1000) : '')
                      : (newBrandForm.unitWeight || '')
                  }
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    if (newBrandModal.productUnit === 'Kilograma(s)' || newBrandModal.productUnit === 'Litro(s)') {
                      const gramas = parseWeightInputForKg(inputValue);
                      const kg = gramas / 1000;
                      handleNewBrandFormChange('unitWeight', kg);
                    } else {
                      const numericValue = parseFloat(inputValue.replace(',', '.')) || 0;
                      handleNewBrandFormChange('unitWeight', numericValue);
                    }
                  }}
                  placeholder={getDynamicWeightPlaceholder(newBrandModal.productUnit)}
                  className="text-base pr-12"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  {getUnitSuffix(newBrandModal.productUnit)}
                </span>
              </div>
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
                onFocus={handleNewBrandPriceFocus}
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
                onFocus={handleNewBrandImageFocus}
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
              disabled={isSubmittingNewBrand || !newBrandForm.brandName.trim() || newBrandForm.unitsInPackaging <= 0 || newBrandForm.totalPackagingPrice <= 0}
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