"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { db } from '@/lib/config/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, collectionGroup } from 'firebase/firestore';
import type { Quotation, ShoppingListItem, Offer, Fornecedor } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

import ResultadoEnvioTab from "@/components/features/cotacao/ResultadoEnvioTab";
import { Loader2 } from "lucide-react";

interface ResultadoEnvioWrapperProps {
  selectedQuotationId: string | null;
}

export default function ResultadoEnvioWrapper({ selectedQuotationId }: ResultadoEnvioWrapperProps) {
  const { user } = useAuth();
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
    console.log("ResultadoEnvioWrapper received new selectedQuotationId:", selectedQuotationId);
  }, [selectedQuotationId]);

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

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!quotation) {
    return <div>Selecione uma cotação para ver os resultados.</div>;
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