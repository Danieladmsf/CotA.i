"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { db } from '@/lib/config/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, collectionGroup } from 'firebase/firestore';
import type { Quotation, ShoppingListItem, Offer, Fornecedor } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

import ResultadoEnvioTab from "@/components/features/cotacao/ResultadoEnvioTab";
import { Loader2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';

interface ResultadoEnvioWrapperProps {
  selectedQuotationId: string | null;
  onTabChange?: (tab: string) => void;
}

export default function ResultadoEnvioWrapper({ selectedQuotationId, onTabChange }: ResultadoEnvioWrapperProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [shoppingListItems, setShoppingListItems] = useState<ShoppingListItem[]>([]);
  const [offers, setOffers] = useState<Map<string, Offer[]>>(new Map());
  const [suppliers, setSuppliers] = useState<Map<string, Fornecedor>>(new Map());

  useEffect(() => {
    if (!user || !selectedQuotationId) {
      setIsLoading(false);
      setQuotation(null);
      return;
    }

    setIsLoading(true);
    const unsub = onSnapshot(doc(db, 'quotations', selectedQuotationId), (doc) => {
        if (doc.exists()) {
            setQuotation({ id: doc.id, ...doc.data() } as Quotation);
        }
        setIsLoading(false);
    });

    return () => unsub();
    
  }, [selectedQuotationId, user]);

  useEffect(() => {
    if (!selectedQuotationId) return;

    const fetchQuotationData = async () => {
      // Fetch shopping list items
      const itemsQuery = query(collection(db, 'shopping_list_items'), where('quotationId', '==', selectedQuotationId));
      const itemsSnapshot = await getDocs(itemsQuery);
      const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShoppingListItem));
      setShoppingListItems(items);

      // Fetch offers
      const offersQuery = query(collectionGroup(db, 'offers'), where('quotationId', '==', selectedQuotationId));
      const offersSnapshot = await getDocs(offersQuery);
      const allOffers = offersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Offer));

      const offersByProduct = new Map<string, Offer[]>();
      for (const offer of allOffers) {
        if (!offersByProduct.has(offer.productId)) {
          offersByProduct.set(offer.productId, []);
        }
        offersByProduct.get(offer.productId)!.push(offer);
      }
      setOffers(offersByProduct);

      // Fetch suppliers
      const supplierIds = new Set(allOffers.map(o => o.supplierId));
      const supplierPromises = Array.from(supplierIds).map(id => getDoc(doc(db, 'fornecedores', id)));
      const supplierSnapshots = await Promise.all(supplierPromises);
      const suppliersMap = new Map<string, Fornecedor>();
      supplierSnapshots.forEach(snap => {
        if (snap.exists()) {
          suppliersMap.set(snap.id, { id: snap.id, ...snap.data() } as Fornecedor);
        }
      });
      setSuppliers(suppliersMap);
    };

    fetchQuotationData();
  }, [selectedQuotationId]);

  // Auto-redirect to step 1 if no quotation or nova-cotacao
  useEffect(() => {
    const shouldRedirect = !selectedQuotationId || selectedQuotationId === 'nova-cotacao';

    if (shouldRedirect && onTabChange) {
      onTabChange('criar-editar');
      toast({
        title: "Redirecionado para Passo 1",
        description: "Inicie uma cotação primeiro para ver os resultados.",
        variant: "default"
      });
    }
  }, [selectedQuotationId, onTabChange, toast]);

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!quotation || selectedQuotationId === 'nova-cotacao') {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
          <p className="text-lg font-semibold text-foreground">Redirecionando para Passo 1...</p>
          <p className="text-muted-foreground mt-2">
            Inicie uma cotação primeiro para ver os resultados.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {quotation && (
        <ResultadoEnvioTab 
          quotation={quotation}
          products={shoppingListItems}
          offers={offers}
          suppliers={suppliers}
        />
      )}
    </div>
  );
}