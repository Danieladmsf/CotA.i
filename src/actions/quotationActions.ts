
'use server';

import { admin, adminDb } from '@/lib/config/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { Fornecedor, ShoppingListItem, Offer } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
// Import the new centralized notification actions
import { sendQuotationInvitation, sendQuotationClosureNotice, sendBuyerQuotationClosureNotice } from './notificationActions';

const QUOTATIONS_COLLECTION = 'quotations';
const SHOPPING_LIST_ITEMS_COLLECTION = 'shopping_list_items';
const FORNECEDORES_COLLECTION = 'fornecedores';


/**
 * Creates a new quotation, updates the associated shopping list items, and sends out invitations to suppliers.
 * This is the main server action to orchestrate the quotation start process.
 * 
 * @returns An object indicating success or failure.
 */
export async function startQuotation(
  listId: string,
  shoppingListDateISO: string,
  supplierIds: string[],
  deadlineISO: string,
  counterProposalTimeInMinutes: number,
  counterProposalReminderPercentage: number,
  formattedDeadline: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const shoppingListDate = new Date(shoppingListDateISO);
  const deadline = new Date(deadlineISO);
  
  if (!listId || !shoppingListDate || supplierIds.length === 0 || !deadline || !formattedDeadline || !userId) {
    return { success: false, error: 'Dados insuficientes para iniciar a cotação.' };
  }

  try {
    const db = adminDb();
    const mainBatch = db.batch();

    // 1. Find items to be included in the quotation
    const itemsQuery = db
      .collection(SHOPPING_LIST_ITEMS_COLLECTION)
      .where('userId', '==', userId)
      .where('listId', '==', listId)
      .where('status', '==', 'Pendente');
    const itemsSnapshot = await itemsQuery.get();
    const itemsToInclude = itemsSnapshot.docs.filter(doc => !doc.data().quotationId);

    if (itemsToInclude.length === 0) {
      throw new Error('Não há itens pendentes nesta lista de compras para iniciar uma cotação. Eles podem já fazer parte de outra cotação.');
    }

    // 2. Create the new quotation document
    const newQuotationRef = db.collection(QUOTATIONS_COLLECTION).doc();
    mainBatch.set(newQuotationRef, {
      shoppingListDate: Timestamp.fromDate(shoppingListDate),
      listId: listId,
      supplierIds: supplierIds,
      deadline: Timestamp.fromDate(deadline),
      counterProposalTimeInMinutes: counterProposalTimeInMinutes,
      counterProposalReminderPercentage: counterProposalReminderPercentage,
      status: 'Aberta',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId,
      userId: userId,
    });

    // 3. Update shopping list items
    itemsToInclude.forEach(doc => {
      mainBatch.update(doc.ref, { quotationId: newQuotationRef.id, status: 'Cotado' });
    });

    // 4. Commit main database writes for quotation and items
    await mainBatch.commit();

    // 5. Fetch selected suppliers and send invitations
    if (supplierIds.length > 30) {
        supplierIds = supplierIds.slice(0, 30);
    }
    
    const suppliersQuery = db.collection(FORNECEDORES_COLLECTION).where(admin.firestore.FieldPath.documentId(), 'in', supplierIds);
    const suppliersSnapshot = await suppliersQuery.get();

    for (const doc of suppliersSnapshot.docs) {
      const supplier = { id: doc.id, ...doc.data() } as Fornecedor;
      try {
          // Use the new centralized notification action
          await sendQuotationInvitation(supplier, formattedDeadline, userId);
      } catch (invitationError: any) {
          // Do not throw, just log the error and continue with the next supplier.
      }
    }
    
    return { success: true };

  } catch (error: any) {
    // This is where the error is caught and sent back to the client.
    const errorMessage = error.message || 'Ocorreu um erro desconhecido ao iniciar a cotação.';
    return { success: false, error: errorMessage };
  }
}

/**
 * Closes a quotation and updates the status of its associated shopping list items.
 * Notifies all participating suppliers about the closure.
 * @param quotationId The ID of the quotation to close.
 * @returns An object indicating success, the number of items updated, or an error.
 */
export async function closeQuotationAndItems(
  quotationId: string,
  userId: string
): Promise<{ success: boolean; updatedItemsCount?: number; error?: string }> {
    if (!userId) {
        return { success: false, error: "User not authenticated." };
    }
    try {
        const db = adminDb();
        const quotationRef = db.collection(QUOTATIONS_COLLECTION).doc(quotationId);
        const quotationSnap = await quotationRef.get();

        if (!quotationSnap.exists) {
            throw new Error("Quotation not found.");
        }
        
        const quotationData = quotationSnap.data();
        if (!quotationData || quotationData.status === 'Fechada' || quotationData.status === 'Concluída') {
            return { success: true, updatedItemsCount: 0 };
        }

        if (quotationData.userId !== userId) {
            throw new Error("Unauthorized access to quotation.");
        }
        
        const listDate = quotationData.shoppingListDate?.toDate();
        if (!listDate) {
             throw new Error("Quotation is missing a shopping list date.");
        }
        
        const batch = db.batch();

        batch.update(quotationRef, { status: "Fechada" });

        const itemsQuery = db.collection(SHOPPING_LIST_ITEMS_COLLECTION)
            .where("quotationId", "==", quotationId);
        
        const itemsSnapshot = await itemsQuery.get();
        
        let updatedItemsCount = 0;
        itemsSnapshot.forEach(doc => {
             const currentStatus = doc.data().status;
            if (currentStatus !== 'Encerrado' && currentStatus !== 'Cancelado' && currentStatus !== 'Recebido') {
                batch.update(doc.ref, { status: "Encerrado" });
                updatedItemsCount++;
            }
        });
        
        await batch.commit();

        // --- Notify ALL invited suppliers ---
        try {
            const invitedSupplierIds = quotationData.supplierIds || [];

            if (invitedSupplierIds.length > 0) {
                const quotationName = quotationData.name || `Cotação de ${format(listDate, "dd/MM/yyyy", { locale: ptBR })}`;
                
                for (const supplierId of invitedSupplierIds) {
                    const supplierDoc = await db.collection(FORNECEDORES_COLLECTION).doc(supplierId).get();
                    if (supplierDoc.exists) {
                        const supplierData = supplierDoc.data() as Fornecedor;
                        if (supplierData.whatsapp) {
                            // Use the new centralized notification action
                            await sendQuotationClosureNotice(supplierData, quotationName, quotationData.userId);
                        }
                    }
                }
            }
        } catch (notificationError: any) {
            // silently ignore
        }

        // --- Notify Buyer ---
        try {
            const settingsDocRef = db.collection('whatsapp_config').doc(quotationData.userId);
            const settingsDoc = await settingsDocRef.get();
            if (settingsDoc.exists) {
                const settingsData = settingsDoc.data();
                const buyerPhoneNumber = settingsData?.buyer_whatsapp_number;

                if (buyerPhoneNumber) {
                    const quotationName = quotationData.name || `Cotação de ${format(listDate, "dd/MM/yyyy", { locale: ptBR })}`;
                    // Use the new centralized notification action for the buyer
                    await sendBuyerQuotationClosureNotice(buyerPhoneNumber, quotationName, updatedItemsCount, quotationData.userId);
                }
            }
        } catch (buyerNotificationError: any) {
            // silently ignore
        }

        return { success: true, updatedItemsCount };

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
