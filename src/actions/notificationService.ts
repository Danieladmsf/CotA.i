'use server';

import { adminDb } from '@/lib/config/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { SystemNotification, NotificationType } from '@/types';

const NOTIFICATIONS_COLLECTION = 'notifications';

interface CreateNotificationParams {
  userId: string;
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
    
    const notification: Omit<SystemNotification, 'id'> = {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      quotationId: params.quotationId,
      quotationName: params.quotationName,
      productId: params.productId,
      productName: params.productName,
      supplierId: params.supplierId,
      supplierName: params.supplierName,
      brandName: params.brandName,
      isRead: false,
      priority: params.priority || 'medium',
      createdAt: Timestamp.now(),
      actionUrl: params.actionUrl,
      metadata: params.metadata
    };

    const docRef = await db.collection(NOTIFICATIONS_COLLECTION).add(notification);
    console.log('✅ Notification created:', docRef.id, params.type);
    
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('❌ Error creating notification:', error);
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
      console.log(`🧹 Cleaned up ${snapshot.size} old notifications for user ${userId}`);
    }
    
    return { success: true, deletedCount: snapshot.size };
  } catch (error: any) {
    console.error('❌ Error cleaning up notifications:', error);
    return { success: false, error: error.message };
  }
}