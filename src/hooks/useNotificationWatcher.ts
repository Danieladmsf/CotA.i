'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/config/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc,
  getDoc
} from 'firebase/firestore';
import { createNotification } from '@/hooks/useNotifications';
import type { PendingBrandRequest } from '@/types';

/**
 * Hook that monitors pending brand requests and creates notifications
 * when new requests are submitted
 */
export const useNotificationWatcher = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) return;

    try {
      // Monitor pending brand requests for new notifications
      const pendingRequestsQuery = query(
        collection(db, 'pending_brand_requests'),
        where('userId', '==', user.uid),
        where('status', '==', 'pending')
      );

      let initialLoad = true;
      const unsubscribe = onSnapshot(
        pendingRequestsQuery,
        async (snapshot) => {
          // Skip initial load to avoid creating notifications for existing requests
          if (initialLoad) {
            initialLoad = false;
            return;
          }

          // Process new documents (added since last snapshot)
          for (const docChange of snapshot.docChanges()) {
            if (docChange.type === 'added') {
              const request = {
                id: docChange.doc.id,
                ...docChange.doc.data()
              } as PendingBrandRequest;

              try {
                // Get quotation name
                const quotationDoc = await getDoc(doc(db, 'quotations', request.quotationId));
                const quotationData = quotationDoc.exists() ? quotationDoc.data() : null;
                const quotationName = quotationData?.name || `Cotação #${request.quotationId.slice(-6)}`;

                // Get product name
                const productDoc = await getDoc(doc(db, 'shopping_list_items', request.productId));
                const productName = productDoc.exists() ? productDoc.data().name : 'Produto desconhecido';

                // Create notification
                await createNotification({
                  userId: user.uid,
                  type: 'brand_approval_pending',
                  title: 'Nova marca aguarda aprovação',
                  message: `${request.supplierName} propôs a marca "${request.brandName}" para ${productName}`,
                  quotationId: request.quotationId,
                  quotationName: quotationName,
                  productName: productName,
                  supplierName: request.supplierName,
                  brandName: request.brandName,
                  isRead: false,
                  priority: 'high',
                  actionUrl: '/cotacao?tab=aprovacoes'
                });

                console.log('✅ Created notification for new brand request:', request.brandName);
              } catch (error) {
                console.error('❌ Error creating brand request notification:', error);
              }
            }
          }
        },
        (error) => {
          console.error('🔴 [useNotificationWatcher] Error in pending_brand_requests listener:', error);
          // Silently handle permission errors - notifications are not critical for core functionality
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up notification watcher:', error);
    }
  }, [user?.uid]);

  return null; // This is a background hook, no UI
};