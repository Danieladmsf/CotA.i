/**
 * useQuotationData Hook
 *
 * Manages quotation data loading and real-time synchronization.
 * Handles quotation document, supplier details, shopping list items, and brand requests.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  collection,
  where
} from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { toast as toastFn } from '@/hooks/use-toast';
import type { Quotation, Fornecedor as SupplierType, ShoppingListItem, UnitOfMeasure, PendingBrandRequest } from '@/types';
import type { CounterProposalInfo } from './useCounterProposalLogic';

// Collection names
const QUOTATIONS_COLLECTION = "quotations";
const FORNECEDORES_COLLECTION = "fornecedores";
const SHOPPING_LIST_ITEMS_COLLECTION = "shopping_list_items";
const PENDING_BRAND_REQUESTS_COLLECTION = "pending_brand_requests";
const OFFERS_COLLECTION = "offers";
import {
  getPreferredBrandsArray,
  abbreviateUnit
} from '@/lib/quotation/utils';
import { Offer } from '@/types';

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

export interface ProductToQuoteVM extends ShoppingListItem {
  supplierOffers: OfferWithUI[];
  bestOffersByBrand: BestOfferForBrandDisplay[];
  lowestPriceThisProductHas?: number | null;
  isDeliveryDayMismatch: boolean;
  counterProposalInfo: CounterProposalInfo | null;
  isLockedOut?: boolean;
  acknowledgedDeliveryMismatches?: string[];
  categoryName?: string;
  pendingBrandRequests?: PendingBrandRequest[];
}

interface UseQuotationDataParams {
  quotationId: string;
  supplierId: string;
  toast: typeof toastFn;
  speak: (message: string) => void;
  voiceMessages: any;
  supplierDetailsCache: React.MutableRefObject<Map<string, SupplierType>>;
}

export function useQuotationData({
  quotationId,
  supplierId,
  toast,
  speak,
  voiceMessages,
  supplierDetailsCache,
}: UseQuotationDataParams) {
  // States
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [currentSupplierDetails, setCurrentSupplierDetails] = useState<SupplierType | null>(null);
  const [productsToQuote, setProductsToQuote] = useState<ProductToQuoteVM[]>([]);
  const [pendingRequestsCache, setPendingRequestsCache] = useState<PendingBrandRequest[]>([]);
  const [stoppedQuotingProducts, setStoppedQuotingProducts] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Listen to quotation document changes
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

  // Load supplier details
  useEffect(() => {
    if (!quotationId || !supplierId) {
      setIsLoading(false);
      toast({ title: "Erro", description: "ID da cotação ou do fornecedor ausente.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    const fetchSupplierData = async () => {
      try {
        const supplierRef = doc(db, FORNECEDORES_COLLECTION, supplierId);
        const supplierSnap = await getDoc(supplierRef);
        if (!supplierSnap.exists()) throw new Error("Fornecedor não encontrado.");
        const fetchedSupplier = { id: supplierSnap.id, ...supplierSnap.data() } as SupplierType;
        setCurrentSupplierDetails(fetchedSupplier);
        supplierDetailsCache.current.set(supplierId, fetchedSupplier);
      } catch (error: any) {
        toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
        speak(voiceMessages.error.loadFailed);
        setIsLoading(false);
      }
    };
    fetchSupplierData();
  }, [quotationId, supplierId, toast, speak, voiceMessages, supplierDetailsCache]);

  // Listen for brand requests (pending and rejected only)
  useEffect(() => {
    if (!quotationId || !supplierId) return;

    const brandRequestsQuery = query(
      collection(db, PENDING_BRAND_REQUESTS_COLLECTION),
      where("quotationId", "==", quotationId),
      where("supplierId", "==", supplierId)
    );

    const unsubscribe = onSnapshot(brandRequestsQuery, (snapshot) => {
      const brandRequests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PendingBrandRequest));

      // Filter only pending and rejected (approved becomes offer automatically)
      const visibleRequests = brandRequests.filter(req => req.status === 'pending' || req.status === 'rejected');

      console.log('🔵 [Brand Requests] Total received:', brandRequests.length);
      console.log('🔵 [Brand Requests] Visible (pending/rejected):', visibleRequests.length);

      // Store in cache for initial product load
      setPendingRequestsCache(visibleRequests);

      // Update products to include visible brand requests (if products already exist)
      setProductsToQuote(prevProducts => {
        if (prevProducts.length === 0) {
          return prevProducts;
        }

        return prevProducts.map(product => {
          const productBrandRequests = visibleRequests.filter(req => req.productId === product.id);
          return {
            ...product,
            pendingBrandRequests: productBrandRequests
          };
        });
      });
    });

    return () => unsubscribe();
  }, [quotationId, supplierId]);

  // Listen for shopping list items (products) - initial load + real-time updates
  useEffect(() => {
    if (!quotationId || !currentSupplierDetails) return;

    const shoppingListItemsQuery = query(
      collection(db, SHOPPING_LIST_ITEMS_COLLECTION),
      where("quotationId", "==", quotationId)
    );

    const unsubscribe = onSnapshot(shoppingListItemsQuery, async (snapshot) => {
      const supplierDeliveryDays = currentSupplierDetails.diasDeEntrega || [];

      // Check if this is initial load
      const isInitialLoad = productsToQuote.length === 0;

      if (isInitialLoad) {
        // Initial load: fetch all offers at once
        const offersQuery = query(
          collection(db, OFFERS_COLLECTION),
          where("quotationId", "==", quotationId)
        );
        const offersSnapshot = await getDoc(doc(db, OFFERS_COLLECTION, quotationId)).catch(() => null);

        // Get all offers for this quotation
        const allOffersQuery = query(
          collection(db, OFFERS_COLLECTION),
          where("quotationId", "==", quotationId)
        );
        const allOffersSnap = await getDocs(allOffersQuery);
        const allOffers = allOffersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Offer));

        const initialProducts = snapshot.docs.map(docSnap => {
          const itemData = docSnap.data() as ShoppingListItem & { stoppedQuotingSuppliers?: string[] };
          const deliveryDateStr = typeof (itemData.deliveryDate as any) === 'string' ? (itemData.deliveryDate as any).toLowerCase() : '';
          const isDeliveryDayMismatch = deliveryDateStr && !supplierDeliveryDays.includes(deliveryDateStr);

          // Check if this supplier stopped quoting this product
          const hasStoppedQuoting = itemData.stoppedQuotingSuppliers?.includes(supplierId) || false;
          if (hasStoppedQuoting) {
            setStoppedQuotingProducts(prev => new Set(prev).add(docSnap.id));
          }

          // Get offers for this product
          const productOffers = allOffers.filter(o => o.productId === docSnap.id);

          // Map to OfferWithUI
          const supplierOffers: OfferWithUI[] = productOffers.map((offer) => ({
            ...offer,
            uiId: offer.id || `temp-${Date.now()}-${Math.random()}`,
          }));

          // Get brand requests from cache
          const productBrandRequests = pendingRequestsCache.filter(req => req.productId === docSnap.id);

          // Build best offers by brand
          const bestOffersByBrand = buildBestOffersByBrand(
            productOffers,
            supplierId,
            supplierDetailsCache.current,
            itemData.unit
          );

          const lowestPriceThisProductHas = bestOffersByBrand.length > 0
            ? Math.min(...bestOffersByBrand.map(b => b.pricePerUnit))
            : null;

          return {
            ...itemData,
            id: docSnap.id,
            supplierOffers,
            bestOffersByBrand,
            lowestPriceThisProductHas,
            isDeliveryDayMismatch,
            counterProposalInfo: null,
            pendingBrandRequests: productBrandRequests,
          } as ProductToQuoteVM;
        });

        setProductsToQuote(initialProducts);
        setIsLoading(false);
      } else {
        // Real-time update: update products incrementally
        setProductsToQuote(prevProducts => {
          return snapshot.docs.map(docSnap => {
            const itemData = docSnap.data() as ShoppingListItem & { stoppedQuotingSuppliers?: string[] };
            const existingProduct = prevProducts.find(p => p.id === docSnap.id);

            // Check if this supplier stopped quoting this product
            const hasStoppedQuoting = itemData.stoppedQuotingSuppliers?.includes(supplierId) || false;
            if (hasStoppedQuoting) {
              setStoppedQuotingProducts(prev => new Set(prev).add(docSnap.id));
            }

            if (existingProduct) {
              // Update existing product while preserving offers and recalculating mismatch
              const deliveryDateStr = typeof (itemData.deliveryDate as any) === 'string' ? (itemData.deliveryDate as any).toLowerCase() : '';
              const isDeliveryDayMismatch = deliveryDateStr && !supplierDeliveryDays.includes(deliveryDateStr);

              return {
                ...existingProduct,
                ...itemData,
                isDeliveryDayMismatch,
              };
            } else {
              // New product added
              const deliveryDateStr = typeof (itemData.deliveryDate as any) === 'string' ? (itemData.deliveryDate as any).toLowerCase() : '';
              const isDeliveryDayMismatch = deliveryDateStr && !supplierDeliveryDays.includes(deliveryDateStr);

              return {
                ...itemData,
                id: docSnap.id,
                supplierOffers: [],
                bestOffersByBrand: [],
                lowestPriceThisProductHas: null,
                isDeliveryDayMismatch,
                counterProposalInfo: null,
                pendingBrandRequests: [],
              } as ProductToQuoteVM;
            }
          });
        });
      }
    });

    return () => unsubscribe();
  }, [quotationId, currentSupplierDetails, supplierId, supplierDetailsCache, pendingRequestsCache]);

  // Listen for offers changes
  useEffect(() => {
    if (!quotationId || !currentSupplierDetails) return;

    const offersQuery = query(
      collection(db, OFFERS_COLLECTION),
      where("quotationId", "==", quotationId)
    );

    const unsubscribe = onSnapshot(offersQuery, (snapshot) => {
      const allOffers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Offer));

      setProductsToQuote(prevProducts =>
        prevProducts.map(product => {
          const productOffers = allOffers.filter(o => o.productId === product.id);

          const supplierOffers: OfferWithUI[] = productOffers.map((offer) => ({
            ...offer,
            uiId: offer.id || `temp-${Date.now()}-${Math.random()}`,
          }));

          const bestOffersByBrand = buildBestOffersByBrand(
            productOffers,
            supplierId,
            supplierDetailsCache.current,
            product.unit
          );

          const lowestPriceThisProductHas = bestOffersByBrand.length > 0
            ? Math.min(...bestOffersByBrand.map(b => b.pricePerUnit))
            : null;

          return {
            ...product,
            supplierOffers,
            bestOffersByBrand,
            lowestPriceThisProductHas,
          };
        })
      );
    });

    return () => unsubscribe();
  }, [quotationId, currentSupplierDetails, supplierId, supplierDetailsCache]);

  return {
    quotation,
    setQuotation,
    currentSupplierDetails,
    productsToQuote,
    setProductsToQuote,
    isLoading,
    pendingRequestsCache,
    stoppedQuotingProducts,
    setStoppedQuotingProducts,
  };
}

// Helper function to build best offers by brand
function buildBestOffersByBrand(
  offers: Offer[],
  currentSupplierId: string,
  supplierCache: Map<string, SupplierType>,
  productUnit: UnitOfMeasure
): BestOfferForBrandDisplay[] {
  const brandMap = new Map<string, BestOfferForBrandDisplay>();

  offers.forEach(offer => {
    const brand = offer.brandOffered?.trim() || '';
    if (!brand) return;

    const existing = brandMap.get(brand);
    const isSelf = offer.supplierId === currentSupplierId;

    if (!existing || offer.pricePerUnit < existing.pricePerUnit) {
      const supplier = supplierCache.get(offer.supplierId);

      brandMap.set(brand, {
        brandName: brand,
        pricePerUnit: offer.pricePerUnit,
        supplierId: offer.supplierId,
        supplierName: offer.supplierName || 'Desconhecido',
        supplierInitials: offer.supplierInitials || '??',
        supplierFotoUrl: supplier?.fotoUrl,
        supplierFotoHint: supplier?.fotoHint,
        vendedor: supplier?.vendedor,
        cnpj: supplier?.cnpj,
        packagingDescription: offer.packagingDescription,
        unitsInPackaging: offer.unitsInPackaging,
        unitWeight: offer.unitWeight,
        totalPackagingPrice: offer.totalPackagingPrice,
        isSelf,
        productUnit,
      });
    }
  });

  return Array.from(brandMap.values()).sort((a, b) => a.pricePerUnit - b.pricePerUnit);
}
