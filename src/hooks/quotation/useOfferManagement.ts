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
} from '@/lib/quotation/utils';
import { handleOutbidNotification } from '@/lib/quotation/notificationHelpers';
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
    const unitWeight = Number(offerData.unitWeight);
    const totalPackagingPrice = Number(offerData.totalPackagingPrice);

    if (isNaN(unitsInPackaging) || unitsInPackaging <= 0 || isNaN(unitsPerPackage) || unitsPerPackage <= 0 || isNaN(unitWeight) || unitWeight <= 0 || isNaN(totalPackagingPrice) || totalPackagingPrice <= 0) {
      toast({ title: "Dados Inválidos", description: "Preencha todos os campos da oferta corretamente (Unidades > 0, Peso > 0, Preço > 0).", variant: "destructive", duration: 7e3 });
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
    };

    const savingKey = `${productId}_${offerUiId}`;
    setIsSaving(prev => ({ ...prev, [savingKey]: true }));
    setSavingOffers(prev => new Set(prev).add(savingKey));

    try {
      if (offerData.id) {
        const offerRef = doc(db, `quotations/${quotationId}/products/${productId}/offers/${offerData.id}`);
        await updateDoc(offerRef, offerPayload);
        toast({ title: "Oferta Atualizada!", description: `Sua oferta para ${product.name} (${offerData.brandOffered}) foi atualizada.` });
        speak(voiceMessages.success.offerSaved);
      } else {
        const offerCollectionRef = collection(db, `quotations/${quotationId}/products/${productId}/offers`);
        const newOfferDocRef = await addDoc(offerCollectionRef, offerPayload);

        // Verificar variação de quantidade
        const offeredQuantity = calculateTotalOfferedQuantity(offerData, product);
        const requestedQuantity = product.quantity;
        const quantityValidation = validateQuantityVariation(offeredQuantity, requestedQuantity);

        toast({ title: "Oferta Salva!", description: `Sua oferta para ${product.name} (${offerData.brandOffered}) foi salva.` });
        setTimeout(() => speak(voiceMessages.success.offerSaved), 0);
      }

      setUnseenAlerts(prev => prev.filter(alertId => alertId !== productId));
      handleOfferChange(productId, offerUiId, 'showBeatOfferOptions', false);

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

  return {
    // States
    isSaving,
    weightInputValues,
    editingOffers,
    savingOffers,

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
  };
}
