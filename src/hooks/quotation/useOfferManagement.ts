/**
 * useOfferManagement Hook
 *
 * Manages all offer-related logic for the supplier quotation portal.
 * Handles offer creation, updates, deletion, and price calculations.
 */

import { useState, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { doc, deleteDoc, addDoc, updateDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { toast } from '@/hooks/use-toast';
import type { Offer, UnitOfMeasure, Quotation, Fornecedor as SupplierType } from '@/types';
import { formatCurrency } from '@/lib/utils';
import {
  parseCurrencyInput,
  parseWeightInputForKg,
  formatWeightInputForKg,
  calculateTotalOfferedQuantity,
  validateQuantityVariation,
  validateBoxQuantityVariation,
} from '@/lib/quotation/utils';
import { handleOutbidNotification } from '@/lib/quotation/notificationHelpers';
import { notifyQuantityVariation } from '@/actions/notificationService';
import type { ProductToQuoteVM } from './useQuotationData';

// Types
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

interface UseOfferManagementParams {
  quotationId: string;
  supplierId: string;
  productsToQuote: any[];
  setProductsToQuote: Dispatch<SetStateAction<any[]>>;
  currentSupplierDetails: SupplierType | null;
  quotation: Quotation | null;
  expandedProductIds: string[];
  setExpandedProductIds: Dispatch<SetStateAction<string[]>>;
  setUnseenAlerts: Dispatch<SetStateAction<string[]>>;
  brandInputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  supplierDetailsCache: React.MutableRefObject<Map<string, SupplierType>>;
  speak: (message: string) => void;
  voiceMessages: any;
}

export function useOfferManagement({
  quotationId,
  supplierId,
  productsToQuote,
  setProductsToQuote,
  currentSupplierDetails,
  quotation,
  expandedProductIds,
  setExpandedProductIds,
  setUnseenAlerts,
  brandInputRefs,
  supplierDetailsCache,
  speak,
  voiceMessages,
}: UseOfferManagementParams) {
  // States
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [weightInputValues, setWeightInputValues] = useState<Record<string, string>>({});
  const [editingOffers, setEditingOffers] = useState<Set<string>>(new Set());
  const [savingOffers, setSavingOffers] = useState<Set<string>>(new Set());

  // Quantity shortage modal states
  const [showQuantityShortageModal, setShowQuantityShortageModal] = useState(false);
  const [quantityShortageContext, setQuantityShortageContext] = useState<{
    product: ProductToQuoteVM;
    offerData: OfferWithUI;
    offerUiId: string;
    productId: string;
    scenario: 'adequate' | 'insufficient' | 'very_insufficient' | 'exact' | 'excess' | 'valid';
    variationPercentage: number;
    variationAmount: number;
  } | null>(null);
  const [quantityDecision, setQuantityDecision] = useState<{
    decision: 'stock_shortage' | 'request_approval' | 'typing_error' | 'send_excess' | 'adjust_to_request' | 'buyer_approval_excess';
    suggestedQuantity?: number;
    correctedData?: {
      unitsPerPackage?: number;
      unitWeight?: number;
      totalPackagingPrice?: number;
      packages?: number;
      // Legacy fields for backward compatibility
      quantity?: number;
      weight?: number;
    };
  } | null>(null);

  const lastClickRef = useRef<{ action: string; timestamp: number } | null>(null);

  // Handle offer field change
  const handleOfferChange = useCallback((
    productId: string,
    offerUiId: string,
    field: keyof OfferWithUI,
    value: string | number | boolean
  ) => {
    setProductsToQuote(prevProducts =>
      prevProducts.map(p =>
        p.id === productId
          ? {
              ...p,
              supplierOffers: p.supplierOffers.map((offer: any) =>
                offer.uiId === offerUiId ? { ...offer, [field]: value, updatedAt: serverTimestamp() as Timestamp } : offer
              ),
            }
          : p
      )
    );
  }, [setProductsToQuote]);

  // Handle price change (converts currency input to decimal)
  const handlePriceChange = useCallback((
    productId: string,
    offerUiId: string,
    inputValue: string
  ) => {
    const centavos = parseCurrencyInput(inputValue);
    const decimalValue = centavos / 100;
    handleOfferChange(productId, offerUiId, 'totalPackagingPrice', decimalValue);
  }, [handleOfferChange]);

  // Handle weight change (supports Kg/L conversion)
  const handleWeightChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    product: ProductToQuoteVM,
    offer: OfferWithUI
  ) => {
    const inputValue = e.target.value;
    const key = `${product.id}_${offer.uiId}`;

    // Para Kg e Litros: usuário digita em gramas/ml, sistema converte para Kg/L
    if (product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)') {
      const gramas = parseWeightInputForKg(inputValue);
      const kg = gramas / 1000;

      const formattedValue = formatWeightInputForKg(gramas);
      setWeightInputValues(prev => ({ ...prev, [key]: formattedValue }));

      handleOfferChange(product.id, offer.uiId, 'unitWeight', kg);
    } else {
      // Para outras unidades: valor direto
      const numericValue = parseFloat(inputValue.replace(',', '.')) || 0;
      handleOfferChange(product.id, offer.uiId, 'unitWeight', numericValue);
    }
  }, [handleOfferChange]);

  // Get weight display value
  const getWeightDisplayValue = useCallback((
    product: ProductToQuoteVM,
    offer: OfferWithUI
  ): string => {
    const key = `${product.id}_${offer.uiId}`;

    // Para Kg/L: usa o valor formatado do state
    if (product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)') {
      if (weightInputValues[key] !== undefined) {
        return weightInputValues[key];
      }
      if (offer.unitWeight) {
        const gramas = Math.round(offer.unitWeight * 1000);
        return formatWeightInputForKg(gramas);
      }
      return '0,000';
    }

    // Para outras unidades: valor direto
    return offer.unitWeight?.toString().replace('.', ',') || '';
  }, [weightInputValues]);

  // Toggle edit mode for an offer
  const toggleEditMode = useCallback((productId: string, offerUiId: string) => {
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
  }, []);

  // Check if offer is in edit mode
  const isInEditMode = useCallback((productId: string, offerUiId: string): boolean => {
    return editingOffers.has(`${productId}_${offerUiId}`);
  }, [editingOffers]);

  // Add new offer field
  const addOfferField = useCallback((
    productId: string,
    brandToPreFill?: string,
    isSuggested?: boolean
  ) => {
    // Prevent duplicate execution
    const executionKey = `addOffer-${productId}-${brandToPreFill}-${isSuggested}`;
    if (lastClickRef.current?.action === executionKey && Date.now() - lastClickRef.current.timestamp < 500) {
      return;
    }
    lastClickRef.current = { action: executionKey, timestamp: Date.now() };

    if (!currentSupplierDetails) {
      toast({ title: "Erro", description: "Dados do fornecedor não carregados.", variant: "destructive" });
      return;
    }

    if (!expandedProductIds.includes(productId)) {
      setExpandedProductIds(prev => [...prev, productId]);
    }

    const newOfferUiId = Date.now().toString() + Math.random().toString(36).substring(2, 7);

    setProductsToQuote(prevProducts => {
      const updatedProducts = prevProducts.map(p => {
        if (p.id === productId) {
          const newOffer: OfferWithUI = {
            uiId: newOfferUiId,
            quotationId: quotationId,
            supplierId: supplierId,
            supplierName: currentSupplierDetails.empresa || "N/A",
            supplierInitials: currentSupplierDetails.empresa.substring(0, 2).toUpperCase() || "XX",
            brandOffered: brandToPreFill || "",
            packagingDescription: "",
            unitsInPackaging: 0,
            unitsPerPackage: 0,
            unitWeight: 0,
            totalPackagingPrice: 0,
            pricePerUnit: 0,
            updatedAt: serverTimestamp() as Timestamp,
            productId: productId,
            isSuggestedBrand: isSuggested || false,
            packagingType: 'closed_package', // Default to closed_package for manual offers
          };

          const updatedProduct = {
            ...p,
            supplierOffers: [...p.supplierOffers, newOffer],
          };

          // Don't auto-focus for suggested brands
          if (!brandToPreFill) {
            setTimeout(() => {
              const brandInputRef = brandInputRefs.current[`${productId}_${newOfferUiId}`];
              brandInputRef?.focus();
            }, 0);
          }
          return updatedProduct;
        }
        return p;
      });
      return updatedProducts;
    });
  }, [
    currentSupplierDetails,
    expandedProductIds,
    quotationId,
    supplierId,
    setProductsToQuote,
    setExpandedProductIds,
    brandInputRefs,
  ]);

  // Remove offer field
  const removeOfferField = useCallback(async (productId: string, offerToRemove: OfferWithUI) => {
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
          ? { ...p, supplierOffers: p.supplierOffers.filter((offer: any) => offer.uiId !== offerToRemove.uiId) }
          : p
      )
    );
  }, [quotationId, setProductsToQuote]);

  // Save product offer
  const handleSaveProductOffer = useCallback(async (
    productId: string,
    offerUiId: string
  ): Promise<boolean> => {
    // Debounce rapid save clicks
    const now = Date.now();
    const actionKey = `save-${productId}-${offerUiId}`;
    if (lastClickRef.current?.action === actionKey && now - lastClickRef.current.timestamp < 1000) {
      return false;
    }
    lastClickRef.current = { action: actionKey, timestamp: now };

    if (!currentSupplierDetails || !quotation || !quotation.userId) {
      toast({ title: "Erro Interno", description: "Dados do fornecedor, cotação ou ID do comprador ausentes.", variant: "destructive" });
      return false;
    }

    const product = productsToQuote.find(p => p.id === productId);
    if (!product) {
      return false;
    }

    const offerToSaveIndex = product.supplierOffers.findIndex((o: any) => o.uiId === offerUiId);
    if (offerToSaveIndex === -1) {
      toast({ title: "Erro", description: "Oferta não encontrada para salvar.", variant: "destructive" });
      return false;
    }
    const offerData = product.supplierOffers[offerToSaveIndex];

    const unitsInPackaging = Number(offerData.unitsInPackaging);
    const unitsPerPackage = Number(offerData.unitsPerPackage);
    let unitWeight = Number(offerData.unitWeight);
    const totalPackagingPrice = Number(offerData.totalPackagingPrice);

    // For unit-based products (Unidade(s)), unitWeight is not required - default to 1
    const isUnitProduct = product.unit === 'Unidade(s)';
    if (isUnitProduct && (isNaN(unitWeight) || unitWeight <= 0)) {
      unitWeight = 1; // Default to 1 for unit products
    }

    // Validate required fields based on product type
    if (isNaN(unitsInPackaging) || unitsInPackaging <= 0) {
      toast({ title: "Dados Inválidos", description: "Preencha a quantidade de caixas/embalagens.", variant: "destructive", duration: 7e3 });
      return false;
    }

    if (isNaN(unitsPerPackage) || unitsPerPackage <= 0) {
      toast({ title: "Dados Inválidos", description: "Preencha quantas unidades vêm na caixa.", variant: "destructive", duration: 7e3 });
      return false;
    }

    if (isNaN(totalPackagingPrice) || totalPackagingPrice <= 0) {
      toast({ title: "Dados Inválidos", description: "Preencha o preço da caixa.", variant: "destructive", duration: 7e3 });
      return false;
    }

    // For weight/volume products, unitWeight is required
    if (!isUnitProduct && (isNaN(unitWeight) || unitWeight <= 0)) {
      toast({ title: "Dados Inválidos", description: "Preencha o peso/volume da embalagem.", variant: "destructive", duration: 7e3 });
      return false;
    }

    const pricePerUnit = totalPackagingPrice / (unitsPerPackage * unitWeight);

    const bestCompetitorOffer = product.bestOffersByBrand.find((o: any) => o.supplierId !== supplierId);

    if (bestCompetitorOffer && pricePerUnit < bestCompetitorOffer.pricePerUnit && pricePerUnit > bestCompetitorOffer.pricePerUnit * 0.99) {
      toast({
        title: "Oferta Inválida",
        description: `Sua oferta deve ser pelo menos 1% menor que a melhor oferta atual de ${formatCurrency(bestCompetitorOffer.pricePerUnit)}. O valor mínimo para cobrir esta oferta é de ${formatCurrency(bestCompetitorOffer.pricePerUnit * 0.99)}. `,
        variant: "destructive",
      });
      return false;
    }

    const isDuplicatePrice = product.bestOffersByBrand.some(
      (offer: any) => offer.pricePerUnit === pricePerUnit && offer.supplierId !== supplierId
    );

    if (isDuplicatePrice) {
      toast({
        title: "Preço Duplicado",
        description: "Este preço já foi ofertado por outro fornecedor. Por favor, insira um valor diferente.",
        variant: "destructive",
      });
      return false;
    }

    const previousBestOffer = product.bestOffersByBrand.length > 0 ? product.bestOffersByBrand[0] : null;

    // Handle outbid notification
    await handleOutbidNotification({
      previousBestOffer,
      newPricePerUnit: pricePerUnit,
      product,
      quotation,
      currentSupplierDetails,
      supplierDetailsCache: supplierDetailsCache.current,
      onError: (message) => {
        toast({
          title: "Falha na Notificação",
          description: message,
          variant: "destructive"
        });
      }
    });

    const offerPayload: Omit<Offer, 'id'> = {
      quotationId: quotationId,
      supplierId: currentSupplierDetails.id,
      supplierName: currentSupplierDetails.empresa,
      supplierInitials: currentSupplierDetails.empresa.substring(0, 2).toUpperCase(),
      brandOffered: offerData.brandOffered,
      packagingDescription: offerData.packagingDescription,
      unitsInPackaging,
      unitsPerPackage: offerData.unitsPerPackage || 0,
      unitWeight,
      totalPackagingPrice,
      pricePerUnit,
      updatedAt: serverTimestamp() as Timestamp,
      productId: productId,
      packagingType: offerData.packagingType || 'closed_package', // Default to closed_package for backward compatibility
    };

    const savingKey = `${productId}_${offerUiId}`;

    // Check for quantity variation BEFORE saving
    // Calculate offered quantity in product's unit (kg/L for weight, units for count)
    const offeredAmount = calculateTotalOfferedQuantity(offerData, product);
    const requestedAmount = product.quantity;
    const boxValidation = validateBoxQuantityVariation(offeredAmount, requestedAmount);

    // If modal is required and no decision has been made yet, show modal
    if (boxValidation.requiresModal && !quantityDecision && !offerData.id) {
      setQuantityShortageContext({
        product,
        offerData,
        offerUiId,
        productId,
        scenario: boxValidation.scenario,
        variationPercentage: boxValidation.variationPercentage,
        variationAmount: boxValidation.variationAmount,
      });
      setShowQuantityShortageModal(true);
      return false; // Don't proceed with save yet
    }

    // If corrected data exists, apply it (regardless of decision type)
    let finalOfferPayload = { ...offerPayload };
    if (quantityDecision?.correctedData) {
      const data = quantityDecision.correctedData;


      // Support both new and legacy field names
      const packages = data.packages ?? data.quantity;
      const weight = data.unitWeight ?? data.weight;
      const unitsPerPkg = data.unitsPerPackage;
      const price = (data as any).price ?? data.totalPackagingPrice;


      if (packages !== undefined) {
        finalOfferPayload.unitsInPackaging = packages;
      }
      if (weight !== undefined) {
        finalOfferPayload.unitWeight = weight;
      }
      if (unitsPerPkg !== undefined) {
        finalOfferPayload.unitsPerPackage = unitsPerPkg;
      }
      if (price !== undefined) {
        finalOfferPayload.totalPackagingPrice = price;
        // Recalculate price per unit
        const finalPackages = finalOfferPayload.unitsInPackaging || packages || 1;
        const finalWeight = finalOfferPayload.unitWeight || weight || 1;
        finalOfferPayload.pricePerUnit = price / (finalPackages * finalWeight);
      }

    }



    setIsSaving(prev => ({ ...prev, [savingKey]: true }));
    setSavingOffers(prev => new Set(prev).add(savingKey));
    let savedOfferId: string | undefined = offerData.id; // Track offer ID for notifications

    try {
      if (offerData.id) {
        const offerRef = doc(db, `quotations/${quotationId}/products/${productId}/offers/${offerData.id}`);
        await updateDoc(offerRef, finalOfferPayload);
        toast({ title: "Oferta Atualizada!", description: `Sua oferta para ${product.name} (${offerData.brandOffered}) foi atualizada.` });
        speak(voiceMessages.success.offerSaved);
      } else {
        const offerCollectionRef = collection(db, `quotations/${quotationId}/products/${productId}/offers`);
        const newOfferDocRef = await addDoc(offerCollectionRef, finalOfferPayload);
        savedOfferId = newOfferDocRef.id; // Update with new offer ID

        toast({ title: "Oferta Salva!", description: `Sua oferta para ${product.name} (${offerData.brandOffered}) foi salva.` });
        setTimeout(() => speak(voiceMessages.success.offerSaved), 0);
      }

      // Verificar variação de quantidade para TODAS as ofertas (novas e editadas)
      // Calculate in product's unit (kg/L for weight products, units for count products)
      // Use finalOfferPayload to get corrected values, not offerData
      const offeredAmount = calculateTotalOfferedQuantity(finalOfferPayload, product);
      const requestedAmount = product.quantity;
      const boxValidation = validateBoxQuantityVariation(offeredAmount, requestedAmount);


      // Mostrar toast informativo para o fornecedor
      if (!boxValidation.isValid) {
        const variationText = boxValidation.variationType === 'over'
          ? `acima (${boxValidation.variationAmount.toFixed(1)} caixas a mais)`
          : `abaixo (${boxValidation.variationAmount.toFixed(1)} caixas a menos)`;

        toast({
          title: "Variação de Quantidade Detectada",
          description: `Sua oferta tem ${boxValidation.variationPercentage.toFixed(1)}% de variação ${variationText} do pedido.`,
          duration: 5000,
        });
      }

      // Notificar o comprador internamente (sistema de notificações do sino)
      // Don't notify if variationType is 'exact' (no variation)
      if (boxValidation.shouldNotifyBuyer && quotation.userId && boxValidation.variationType !== 'exact') {

        // Map decision types to shortageReason types
        const shortageReasonMap: Record<string, 'stock_shortage' | 'request_approval' | 'buyer_approval_excess' | undefined> = {
          'stock_shortage': 'stock_shortage',
          'request_approval': 'request_approval',
          'buyer_approval_excess': 'buyer_approval_excess',
        };
        const mappedShortageReason = quantityDecision?.decision
          ? shortageReasonMap[quantityDecision.decision]
          : undefined;

        try {
          const result = await notifyQuantityVariation({
            userId: quotation.userId,
            quotationId: quotationId,
            quotationName: quotation.name || `Cotação #${quotationId.slice(-6)}`,
            productId: productId,
            productName: product.name,
            supplierName: currentSupplierDetails.empresa,
            supplierId: supplierId,
            brandName: offerData.brandOffered,
            requestedQuantity: requestedAmount,
            offeredPackages: finalOfferPayload.unitsInPackaging, // Number of packages
            unit: product.unit,
            offerId: savedOfferId,
            unitsPerPackage: finalOfferPayload.unitsPerPackage, // Units per package
            unitWeight: finalOfferPayload.unitWeight,
            totalPackagingPrice: finalOfferPayload.totalPackagingPrice,
          });

          if (result.success) {
          } else {
            console.warn('⚠️ [Quantity Notification] Failed to create notification:', result.error);
          }
        } catch (notifError: any) {
          console.error('❌ [Quantity Notification] Exception while creating notification:', {
            error: notifError.message,
            code: notifError.code,
            stack: notifError.stack,
          });
          // Don't block offer save if notification fails
        }
      } else {
      }

      setUnseenAlerts(prev => prev.filter(alertId => alertId !== productId));
      handleOfferChange(productId, offerUiId, 'showBeatOfferOptions', false);

      // Update local state with final values to sync UI immediately
      // This ensures the form fields show the correct values that were saved
      if (finalOfferPayload.unitsInPackaging !== offerData.unitsInPackaging && finalOfferPayload.unitsInPackaging !== undefined) {
        handleOfferChange(productId, offerUiId, 'unitsInPackaging', finalOfferPayload.unitsInPackaging);
      }
      if (finalOfferPayload.unitWeight !== offerData.unitWeight && finalOfferPayload.unitWeight !== undefined) {
        handleOfferChange(productId, offerUiId, 'unitWeight', finalOfferPayload.unitWeight);
      }
      if (finalOfferPayload.unitsPerPackage !== offerData.unitsPerPackage && finalOfferPayload.unitsPerPackage !== undefined) {
        handleOfferChange(productId, offerUiId, 'unitsPerPackage', finalOfferPayload.unitsPerPackage);
      }
      if (finalOfferPayload.totalPackagingPrice !== offerData.totalPackagingPrice && finalOfferPayload.totalPackagingPrice !== undefined) {
        handleOfferChange(productId, offerUiId, 'totalPackagingPrice', finalOfferPayload.totalPackagingPrice);
      }
      if (finalOfferPayload.pricePerUnit !== offerData.pricePerUnit && finalOfferPayload.pricePerUnit !== undefined) {
        handleOfferChange(productId, offerUiId, 'pricePerUnit', finalOfferPayload.pricePerUnit);
      }

      return true;
    } catch (error: any) {
      toast({ title: "Erro ao Salvar Oferta", description: error.message, variant: "destructive" });
      setTimeout(() => speak(voiceMessages.error.saveFailed), 0);
      return false;
    } finally {
      setIsSaving(prev => ({ ...prev, [savingKey]: false }));
      setSavingOffers(prev => {
        const newSet = new Set(prev);
        newSet.delete(savingKey);
        return newSet;
      });
    }
  }, [
    currentSupplierDetails,
    quotation,
    productsToQuote,
    quotationId,
    supplierId,
    supplierDetailsCache,
    setUnseenAlerts,
    handleOfferChange,
    speak,
    voiceMessages,
  ]);

  // Handle quantity shortage modal decision
  const handleQuantityShortageDecision = useCallback(async (
    decision: 'stock_shortage' | 'request_approval' | 'typing_error' | 'send_excess' | 'adjust_to_request' | 'buyer_approval_excess',
    correctedData?: {
      unitsPerPackage?: number;
      unitWeight?: number;
      totalPackagingPrice?: number;
      packages?: number;
      quantity?: number;
      weight?: number;
    }
  ) => {

    setQuantityDecision({
      decision,
      correctedData: correctedData // Always pass correctedData if it exists, regardless of decision
    });
    setShowQuantityShortageModal(false);

    // Resume the save process with the decision
    if (quantityShortageContext) {
      const { product, offerData, offerUiId, productId } = quantityShortageContext;

      // Call handleSaveProductOffer again, now with quantityDecision set
      // The save will proceed this time
      await handleSaveProductOffer(productId, offerUiId);

      // Clear the context and decision after save
      setQuantityShortageContext(null);
      setQuantityDecision(null);
    }
  }, [quantityShortageContext, handleSaveProductOffer]);

  const handleCloseQuantityShortageModal = useCallback(() => {
    setShowQuantityShortageModal(false);
    setQuantityShortageContext(null);
  }, []);

  return {
    // States
    isSaving,
    weightInputValues,
    editingOffers,
    savingOffers,
    showQuantityShortageModal,
    quantityShortageContext,

    // Handlers
    handleOfferChange,
    handlePriceChange,
    handleWeightChange,
    getWeightDisplayValue,
    toggleEditMode,
    isInEditMode,
    addOfferField,
    removeOfferField,
    handleSaveProductOffer,
    handleQuantityShortageDecision,
    handleCloseQuantityShortageModal,
  };
}
