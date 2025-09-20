
'use server';

import { admin, adminDb } from '@/lib/config/firebase-admin';
import type { Fornecedor, IncomingMessage } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const MESSAGES_COLLECTION = 'incoming_messages'; // Unificada para todas as mensagens

/**
 * Adds a message to the unified message collection with a 'pending' status,
 * which the WhatsApp bridge will then pick up and send.
 */
async function queueMessageForSending(phoneNumber: string, messageContent: string, userId: string, supplierName?: string) {
    const cleanedPhoneNumber = String(phoneNumber).replace(/\D/g, '');
    if (!cleanedPhoneNumber || !messageContent || !userId) {
        console.warn(`[Notification] Skipped queuing message due to missing phone number, message content, or userId.`);
        return;
    }

    const messageEntry: Omit<IncomingMessage, 'id'> = {
        isOutgoing: true,
        phoneNumber: cleanedPhoneNumber,
        supplierName: supplierName || 'N/A',
        message: messageContent,
        status: 'pending',
        userId: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    await adminDb.collection(MESSAGES_COLLECTION).add(messageEntry);
}


/**
 * Sends the supplier portal access link via WhatsApp.
 */
export async function sendPortalLink(
    supplier: { whatsapp?: string; empresa: string; vendedor?: string; userId: string; },
    portalLink: string
): Promise<{ success: boolean; error?: string }> {
    if (!supplier.whatsapp) {
        return { success: false, error: `Fornecedor ${supplier.empresa} não possui WhatsApp.` };
    }
    const message = `Olá, ${supplier.vendedor || supplier.empresa}! Aqui está o seu link de acesso exclusivo ao nosso portal de cotações: ${portalLink}`;
    try {
        await queueMessageForSending(supplier.whatsapp, message, supplier.userId, supplier.empresa);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


/**
 * Sends a WhatsApp invitation to a supplier for a new quotation.
 */
export async function sendQuotationInvitation(
    supplier: Fornecedor, 
    formattedDeadline: string,
    userId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!supplier.whatsapp) {
        return { success: false, error: `Fornecedor ${supplier.empresa} não possui WhatsApp.` };
    }
    const message = `Olá, ${supplier.vendedor || supplier.empresa}! Uma nova cotação foi aberta e gostaríamos de contar com sua participação. O prazo para envio de ofertas é até ${formattedDeadline}.`;
    try {
        await queueMessageForSending(supplier.whatsapp, message, userId, supplier.empresa);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


/**
 * Sends a notification to a supplier that a quotation has been closed.
 */
export async function sendQuotationClosureNotice(
    supplier: Fornecedor,
    quotationName: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
     if (!supplier.whatsapp) {
        return { success: false, error: `Fornecedor ${supplier.empresa} não possui WhatsApp.` };
    }
    const message = `A cotação '${quotationName}' foi encerrada. Agradecemos sua participação. Os resultados finais já estão disponíveis no portal de cotações.`;
    try {
        await queueMessageForSending(supplier.whatsapp, message, userId, supplier.empresa);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Sends a notification to the buyer that a quotation has been closed.
 */
export async function sendBuyerQuotationClosureNotice(
    buyerPhoneNumber: string,
    quotationName: string,
    updatedItemsCount: number,
    userId: string,
): Promise<{ success: boolean; error?: string }> {
    const message = `✅ Cotação Encerrada: A cotação '${quotationName}' foi finalizada. ${updatedItemsCount} item(ns) foram atualizados para 'Encerrado'.`;
    try {
        await queueMessageForSending(buyerPhoneNumber, message, userId);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Sends a notification to a supplier when their offer has been outbid.
 */
export async function sendOutbidNotification(
    outbidSupplierInfo: { whatsapp?: string; empresa: string },
    notificationData: {
      productName: string;
      brandName: string;
      newBestPriceFormatted: string;
      unitAbbreviated: string;
      winningSupplierName: string;
      counterProposalTimeInMinutes: number;
    },
    userId: string
): Promise<{ success: boolean; error?: string }> {
    if (!outbidSupplierInfo.whatsapp) {
        return { success: false, error: `Supplier ${outbidSupplierInfo.empresa} has no WhatsApp number.` };
    }
    const message = `Atenção! Sua oferta para *${notificationData.productName} (${notificationData.brandName})* foi superada. 🚀 O novo melhor preço é *${notificationData.newBestPriceFormatted} por ${notificationData.unitAbbreviated}*, oferecido por *${notificationData.winningSupplierName}*. Você tem *${notificationData.counterProposalTimeInMinutes} minutos* para fazer uma contraproposta e não perder a oportunidade!`;
    try {
        await queueMessageForSending(outbidSupplierInfo.whatsapp, message, userId, outbidSupplierInfo.empresa);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Sends a reminder to a supplier that their time for a counter-proposal is running out.
 * NOTE: This function needs to be triggered by a scheduled job (e.g., Firebase Scheduled Function).
 */
export async function sendCounterProposalReminder(
    supplier: Fornecedor,
    productName: string,
    brandName: string,
    minutesLeft: number,
    userId: string,
): Promise<{ success: boolean; error?: string }> {
     if (!supplier.whatsapp) {
        return { success: false, error: `Fornecedor ${supplier.empresa} não possui WhatsApp.` };
    }
    const message = `⏳ Lembrete: Faltam apenas *${minutesLeft} minutos* para o fim do prazo da sua contraproposta para *${productName} (${brandName})*. Não perca a chance!`;
    try {
        await queueMessageForSending(supplier.whatsapp, message, userId, supplier.empresa);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
