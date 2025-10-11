'use server';

import { adminDb } from '@/lib/config/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { SystemNotification, NotificationType } from '@/types';

const NOTIFICATIONS_COLLECTION = 'notifications';

interface CreateNotificationParams {
  userId?: string; // Optional for supplier notifications (use targetSupplierId instead)
  targetSupplierId?: string; // For supplier portal notifications (unauthenticated access)
  type: NotificationType;
  title: string;
  message: string;
  quotationId?: string;
  quotationName?: string;
  productId?: string;
  productName?: string;
  supplierId?: string;
  supplierName?: string;
  brandName?: string;
  priority?: 'low' | 'medium' | 'high';
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    const db = adminDb();

    // Validate that at least one identifier is present
    if (!params.userId && !params.targetSupplierId) {
      throw new Error('Either userId or targetSupplierId must be provided');
    }

    // Build notification object, only including defined fields to avoid Firestore undefined errors
    const notification: any = {
      type: params.type,
      title: params.title,
      message: params.message,
      isRead: false,
      priority: params.priority || 'medium',
      createdAt: Timestamp.now()
    };

    // Add userId or targetSupplierId (mutually exclusive usage)
    if (params.userId !== undefined) notification.userId = params.userId;
    if (params.targetSupplierId !== undefined) notification.targetSupplierId = params.targetSupplierId;

    // Only add optional fields if they're defined
    if (params.quotationId !== undefined) notification.quotationId = params.quotationId;
    if (params.quotationName !== undefined) notification.quotationName = params.quotationName;
    if (params.productId !== undefined) notification.productId = params.productId;
    if (params.productName !== undefined) notification.productName = params.productName;
    if (params.supplierId !== undefined) notification.supplierId = params.supplierId;
    if (params.supplierName !== undefined) notification.supplierName = params.supplierName;
    if (params.brandName !== undefined) notification.brandName = params.brandName;
    if (params.actionUrl !== undefined) notification.actionUrl = params.actionUrl;
    if (params.metadata !== undefined) notification.metadata = params.metadata;

    const docRef = await db.collection(NOTIFICATIONS_COLLECTION).add(notification);

    return { success: true, id: docRef.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Specific notification creators for common scenarios

export async function notifyBrandApprovalPending(params: {
  userId: string;
  quotationId: string;
  quotationName: string;
  productName: string;
  brandName: string;
  supplierName: string;
}) {
  return createNotification({
    userId: params.userId,
    type: 'brand_approval_pending',
    title: 'Nova marca aguarda aprovação',
    message: `${params.supplierName} propôs a marca "${params.brandName}" para ${params.productName}`,
    quotationId: params.quotationId,
    quotationName: params.quotationName,
    productName: params.productName,
    supplierName: params.supplierName,
    brandName: params.brandName,
    priority: 'high',
    actionUrl: '/cotacao?tab=aprovacoes'
  });
}

export async function notifyBrandApproved(params: {
  userId: string;
  quotationId: string;
  quotationName: string;
  productName: string;
  brandName: string;
  supplierName: string;
}) {
  return createNotification({
    userId: params.userId,
    type: 'brand_approval_approved',
    title: 'Marca aprovada com sucesso',
    message: `A marca "${params.brandName}" de ${params.supplierName} foi aprovada para ${params.productName}`,
    quotationId: params.quotationId,
    quotationName: params.quotationName,
    productName: params.productName,
    supplierName: params.supplierName,
    brandName: params.brandName,
    priority: 'medium',
    actionUrl: `/cotacao?quotation=${params.quotationId}`
  });
}

export async function notifyBrandRejected(params: {
  userId: string;
  quotationId: string;
  quotationName: string;
  productName: string;
  brandName: string;
  supplierName: string;
  rejectionReason?: string;
}) {
  return createNotification({
    userId: params.userId,
    type: 'brand_approval_rejected',
    title: 'Marca rejeitada',
    message: `A marca "${params.brandName}" de ${params.supplierName} foi rejeitada para ${params.productName}`,
    quotationId: params.quotationId,
    quotationName: params.quotationName,
    productName: params.productName,
    supplierName: params.supplierName,
    brandName: params.brandName,
    priority: 'low',
    actionUrl: `/cotacao?quotation=${params.quotationId}`,
    metadata: { rejectionReason: params.rejectionReason }
  });
}

// Supplier-facing notification functions (use targetSupplierId for anonymous portal access)

export async function notifySupplierBrandApproved(params: {
  targetSupplierId: string;
  quotationId: string;
  productName: string;
  brandName: string;
}) {
  return createNotification({
    targetSupplierId: params.targetSupplierId,
    type: 'brand_approval_approved',
    title: 'Sua marca foi aprovada!',
    message: `Sua sugestão da marca "${params.brandName}" para o produto "${params.productName}" foi aprovada.`,
    quotationId: params.quotationId,
    productName: params.productName,
    brandName: params.brandName,
    priority: 'high',
    actionUrl: `/portal/${params.targetSupplierId}/cotar/${params.quotationId}`
  });
}

export async function notifySupplierBrandRejected(params: {
  targetSupplierId: string;
  quotationId: string;
  productName: string;
  brandName: string;
  rejectionReason?: string;
}) {
  return createNotification({
    targetSupplierId: params.targetSupplierId,
    type: 'brand_approval_rejected',
    title: 'Sua marca foi recusada',
    message: `Sua sugestão da marca "${params.brandName}" para o produto "${params.productName}" foi recusada.`,
    quotationId: params.quotationId,
    productName: params.productName,
    brandName: params.brandName,
    priority: 'high',
    actionUrl: `/portal/${params.targetSupplierId}/cotar/${params.quotationId}`,
    metadata: params.rejectionReason ? { rejectionReason: params.rejectionReason } : undefined
  });
}

export async function notifyQuotationStarted(params: {
  userId: string;
  quotationId: string;
  quotationName: string;
  itemsCount: number;
  suppliersCount: number;
  deadline: Date;
}) {
  return createNotification({
    userId: params.userId,
    type: 'quotation_started',
    title: 'Cotação iniciada',
    message: `Cotação "${params.quotationName}" iniciada com ${params.itemsCount} itens para ${params.suppliersCount} fornecedores`,
    quotationId: params.quotationId,
    quotationName: params.quotationName,
    priority: 'high',
    actionUrl: `/cotacao?quotation=${params.quotationId}`,
    metadata: { 
      itemsCount: params.itemsCount,
      suppliersCount: params.suppliersCount,
      deadline: params.deadline.toISOString()
    }
  });
}

export async function notifyQuotationClosed(params: {
  userId: string;
  quotationId: string;
  quotationName: string;
  totalOffers: number;
  closedItemsCount: number;
}) {
  return createNotification({
    userId: params.userId,
    type: 'quotation_closed',
    title: 'Cotação encerrada',
    message: `Cotação "${params.quotationName}" foi encerrada com ${params.totalOffers} ofertas recebidas`,
    quotationId: params.quotationId,
    quotationName: params.quotationName,
    priority: 'high',
    actionUrl: `/cotacao?quotation=${params.quotationId}`,
    metadata: { 
      totalOffers: params.totalOffers,
      closedItemsCount: params.closedItemsCount
    }
  });
}

export async function notifyOfferReceived(params: {
  userId: string;
  quotationId: string;
  quotationName: string;
  productName: string;
  supplierName: string;
  brandName: string;
  pricePerUnit: number;
}) {
  return createNotification({
    userId: params.userId,
    type: 'offer_received',
    title: 'Nova oferta recebida',
    message: `${params.supplierName} enviou oferta para ${params.productName} (${params.brandName}) - R$ ${params.pricePerUnit.toFixed(2)}/un`,
    quotationId: params.quotationId,
    quotationName: params.quotationName,
    productName: params.productName,
    supplierName: params.supplierName,
    brandName: params.brandName,
    priority: 'medium',
    actionUrl: `/cotacao?quotation=${params.quotationId}`,
    metadata: { pricePerUnit: params.pricePerUnit }
  });
}

export async function notifyOfferOutbid(params: {
  userId: string;
  quotationId: string;
  quotationName: string;
  productName: string;
  brandName: string;
  oldSupplierName: string;
  newSupplierName: string;
  newBestPrice: number;
}) {
  return createNotification({
    userId: params.userId,
    type: 'offer_outbid',
    title: 'Oferta foi superada',
    message: `${params.newSupplierName} superou ${params.oldSupplierName} em ${params.productName} (${params.brandName}) com R$ ${params.newBestPrice.toFixed(2)}/un`,
    quotationId: params.quotationId,
    quotationName: params.quotationName,
    productName: params.productName,
    brandName: params.brandName,
    priority: 'medium',
    actionUrl: `/cotacao?quotation=${params.quotationId}`,
    metadata: { 
      oldSupplierName: params.oldSupplierName,
      newSupplierName: params.newSupplierName,
      newBestPrice: params.newBestPrice
    }
  });
}

export async function notifyDeadlineApproaching(params: {
  userId: string;
  quotationId: string;
  quotationName: string;
  hoursLeft: number;
}) {
  return createNotification({
    userId: params.userId,
    type: 'deadline_approaching',
    title: 'Prazo se aproximando',
    message: `Restam apenas ${params.hoursLeft}h para o encerramento da cotação "${params.quotationName}"`,
    quotationId: params.quotationId,
    quotationName: params.quotationName,
    priority: 'high',
    actionUrl: `/cotacao?quotation=${params.quotationId}`,
    metadata: { hoursLeft: params.hoursLeft }
  });
}

// Utility function to clean old notifications (call this periodically)
export async function cleanupOldNotifications(userId: string, daysToKeep: number = 30) {
  try {
    const db = adminDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const oldNotificationsQuery = db
      .collection(NOTIFICATIONS_COLLECTION)
      .where('userId', '==', userId)
      .where('createdAt', '<', Timestamp.fromDate(cutoffDate));
    
    const snapshot = await oldNotificationsQuery.get();
    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    if (snapshot.docs.length > 0) {
      await batch.commit();
    }

    return { success: true, deletedCount: snapshot.size };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}