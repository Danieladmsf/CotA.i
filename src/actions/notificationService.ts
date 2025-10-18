'use server';

import { adminDb } from '@/lib/config/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { SystemNotification, NotificationType } from '@/types';

const NOTIFICATIONS_COLLECTION = 'notifications';

interface CreateNotificationParams {
  userId?: string;
  targetSupplierId?: string;
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
    if (!params.userId && !params.targetSupplierId) {
      throw new Error('Either userId or targetSupplierId must be provided');
    }
    const now = Timestamp.now();
    const formattedTimestamp = now.toDate().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const notification: any = {
      type: params.type,
      title: params.title,
      message: `[${formattedTimestamp}] ${params.message}`,
      isRead: false,
      priority: params.priority || 'medium',
      createdAt: now
    };
    if (params.userId !== undefined) notification.userId = params.userId;
    if (params.targetSupplierId !== undefined) notification.targetSupplierId = params.targetSupplierId;
    if (params.quotationId !== undefined) notification.quotationId = params.quotationId;
    if (params.quotationName !== undefined) notification.quotationName = params.quotationName;
    if (params.productId !== undefined) notification.productId = params.productId;
    if (params.productName !== undefined) notification.productName = params.productName;
    if (params.supplierId !== undefined) notification.supplierId = params.supplierId;
    if (params.supplierName !== undefined) notification.supplierName = params.supplierName;
    if (params.brandName !== undefined) notification.brandName = params.brandName;
    if (params.actionUrl !== undefined) notification.actionUrl = params.actionUrl;
    if (params.metadata !== undefined) {
      const cleanedMetadata: Record<string, any> = {};
      Object.entries(params.metadata).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanedMetadata[key] = value;
        }
      });
      if (Object.keys(cleanedMetadata).length > 0) {
        notification.metadata = cleanedMetadata;
      }
    }
    const docRef = await db.collection(NOTIFICATIONS_COLLECTION).add(notification);
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('❌ [createNotification] Error:', error);
    return { success: false, error: error.message };
  }
}

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

export async function notifyQuantityVariation(params: {
  userId: string;
  quotationId: string;
  quotationName: string;
  productId: string;
  productName: string;
  supplierName: string;
  supplierId: string;
  brandName: string;
  requestedQuantity: number;
  offeredPackages: number;
  unit: string;
  offerId?: string;
  unitsPerPackage?: number;
  unitWeight?: number;
  totalPackagingPrice?: number;
}) {
  const { 
    requestedQuantity, 
    offeredPackages, 
    unit, 
    unitWeight, 
    unitsPerPackage, 
    totalPackagingPrice 
  } = params;

  const isWeightVolume = unit === 'Kilograma(s)' || unit === 'Grama(s)' || unit === 'Litro(s)' || unit === 'Mililitro(s)';
  const quantityPerPackage = isWeightVolume ? (unitWeight || 0) : (unitsPerPackage || 0);
  const actualOfferedQuantity = offeredPackages * quantityPerPackage;
  const actualVariationAmount = actualOfferedQuantity - requestedQuantity;
  const actualVariationPercentage = requestedQuantity > 0 ? (actualVariationAmount / requestedQuantity) * 100 : 0;

  let suggestions = null;
  if (quantityPerPackage > 0 && requestedQuantity > 0) {
    const idealPackages = requestedQuantity / quantityPerPackage;
    const floorPackages = Math.floor(idealPackages);
    const ceilPackages = Math.ceil(idealPackages);

    const pricePerPackage = offeredPackages > 0 ? (totalPackagingPrice || 0) / offeredPackages : 0;

    const floorSuggestion = {
      packages: floorPackages,
      totalQuantity: floorPackages * quantityPerPackage,
      variation: (floorPackages * quantityPerPackage) - requestedQuantity,
      totalPrice: pricePerPackage > 0 ? floorPackages * pricePerPackage : undefined,
    };

    const ceilSuggestion = {
      packages: ceilPackages,
      totalQuantity: ceilPackages * quantityPerPackage,
      variation: (ceilPackages * quantityPerPackage) - requestedQuantity,
      totalPrice: pricePerPackage > 0 ? ceilPackages * pricePerPackage : undefined,
    };

    // Always include the actual offered quantity as a third option
    const offeredSuggestion = {
      packages: offeredPackages,
      totalQuantity: actualOfferedQuantity,
      variation: actualVariationAmount,
      totalPrice: totalPackagingPrice,
    };

    // Build suggestions object with smart logic:
    // - floor: lower option (if different from offered)
    // - ceil: higher option (if different from floor and offered)
    // - offered: what supplier actually sent (always included)
    suggestions = {
        floor: (floorPackages > 0 && floorPackages !== offeredPackages) ? floorSuggestion : null,
        ceil: (ceilPackages > 0 && ceilPackages !== floorPackages && ceilPackages !== offeredPackages) ? ceilSuggestion : null,
        offered: offeredSuggestion,
    };
  }

  const variationIcon = actualVariationAmount > 0 ? '📈' : '📉';

  const message = `${params.supplierName} ofereceu uma quantidade diferente para ${params.productName} (${params.brandName}). Solicitado: ${requestedQuantity} ${unit}. Oferecido: ${actualOfferedQuantity.toFixed(1)} ${unit}.`;

  return createNotification({
    userId: params.userId,
    type: 'quantity_variation_detected',
    title: `${variationIcon} Variação de Quantidade em ${params.productName}`,
    message: message,
    quotationId: params.quotationId,
    quotationName: params.quotationName,
    productId: params.productId,
    productName: params.productName,
    supplierId: params.supplierId,
    supplierName: params.supplierName,
    brandName: params.brandName,
    priority: 'high',
    actionUrl: `/cotacao?quotation=${params.quotationId}&tab=aprovacoes-quantidade`,
    metadata: {
      requestedQuantity: params.requestedQuantity,
      offeredQuantity: actualOfferedQuantity,
      unit: params.unit,
      variationType: actualVariationAmount > 0 ? 'over' : 'under',
      variationPercentage: actualVariationPercentage,
      variationAmount: actualVariationAmount,
      offerId: params.offerId,
      originalOffer: {
          packages: offeredPackages,
          unitsPerPackage: params.unitsPerPackage,
          unitWeight: params.unitWeight,
          totalPackagingPrice: params.totalPackagingPrice,
      },
      suggestions: suggestions
    }
  });
}

export async function notifyBuyerQuantityAdjustmentRequested(params: {
  targetSupplierId: string;
  quotationId: string;
  quotationName: string;
  productId: string;
  productName: string;
  brandName: string;
  originalOfferedBoxes: number;
  adjustedBoxes: number;
  originalUnitsInPackaging: number;
  adjustedUnitsInPackaging: number;
  offerId: string;
  notificationId: string;
}) {
  return createNotification({
    targetSupplierId: params.targetSupplierId,
    type: 'buyer_quantity_adjustment_requested',
    title: '✏️ Comprador Solicitou Ajuste de Quantidade',
    message: `O comprador solicitou ajuste para ${params.productName} (${params.brandName}): ${params.adjustedBoxes} caixas com ${params.adjustedUnitsInPackaging} un/emb (original: ${params.originalOfferedBoxes} caixas, ${params.originalUnitsInPackaging} un/emb)`,
    quotationId: params.quotationId,
    quotationName: params.quotationName,
    productId: params.productId,
    productName: params.productName,
    brandName: params.brandName,
    priority: 'high',
    actionUrl: `/portal/${params.targetSupplierId}/cotar/${params.quotationId}?tab=ajustes`,
    metadata: {
      originalOfferedBoxes: params.originalOfferedBoxes,
      adjustedBoxes: params.adjustedBoxes,
      originalUnitsInPackaging: params.originalUnitsInPackaging,
      adjustedUnitsInPackaging: params.adjustedUnitsInPackaging,
      offerId: params.offerId,
      buyerNotificationId: params.notificationId
    }
  });
}

export async function notifyQuantityAdjustmentApproved(params: {
  userId: string;
  quotationId: string;
  quotationName: string;
  productId: string;
  productName: string;
  supplierName: string;
  brandName: string;
  adjustedBoxes: number;
  adjustedUnitsInPackaging: number;
  notificationId: string;
}) {
  return createNotification({
    userId: params.userId,
    type: 'quantity_adjustment_approved',
    title: '✅ Ajuste de Quantidade Aprovado',
    message: `${params.supplierName} aprovou o ajuste para ${params.productName} (${params.brandName}): ${params.adjustedBoxes} caixas com ${params.adjustedUnitsInPackaging} un/emb`,
    quotationId: params.quotationId,
    quotationName: params.quotationName,
    productId: params.productId,
    productName: params.productName,
    supplierName: params.supplierName,
    brandName: params.brandName,
    priority: 'high',
    actionUrl: `/cotacao?quotation=${params.quotationId}&tab=aprovacoes-quantidade`,
    metadata: {
      adjustedBoxes: params.adjustedBoxes,
      adjustedUnitsInPackaging: params.adjustedUnitsInPackaging,
      originalNotificationId: params.notificationId
    }
  });
}

export async function notifyQuantityAdjustmentRejected(params: {
  userId: string;
  quotationId: string;
  quotationName: string;
  productId: string;
  productName: string;
  supplierName: string;
  brandName: string;
  rejectionReason?: string;
  notificationId: string;
}) {
  return createNotification({
    userId: params.userId,
    type: 'quantity_adjustment_rejected',
    title: '❌ Ajuste de Quantidade Recusado',
    message: `${params.supplierName} recusou o ajuste para ${params.productName} (${params.brandName})${params.rejectionReason ? `: ${params.rejectionReason}` : ''}`,
    quotationId: params.quotationId,
    quotationName: params.quotationName,
    productId: params.productId,
    productName: params.productName,
    supplierName: params.supplierName,
    brandName: params.brandName,
    priority: 'high',
    actionUrl: `/cotacao?quotation=${params.quotationId}&tab=aprovacoes-quantidade`,
    metadata: {
      rejectionReason: params.rejectionReason,
      originalNotificationId: params.notificationId
    }
  });
}

export async function notifySellerOfBuyerAdjustment(params: {
  targetSupplierId: string;
  quotationId: string;
  productName: string;
  brandName: string;
  originalBoxes: number;
  adjustedBoxes: number;
  totalQuantity: number;
  unit: string;
}) {
  return createNotification({
    targetSupplierId: params.targetSupplierId,
    type: 'buyer_adjustment_applied',
    title: 'Sua oferta foi ajustada pelo comprador',
    message: `Para o item ${params.productName} (${params.brandName}), o comprador ajustou sua oferta de ${params.originalBoxes} para ${params.adjustedBoxes} caixas, totalizando ${params.totalQuantity.toFixed(1)} ${params.unit}.`,
    quotationId: params.quotationId,
    productName: params.productName,
    brandName: params.brandName,
    priority: 'medium',
    actionUrl: `/portal/${params.targetSupplierId}/cotar/${params.quotationId}`,
    metadata: {
      originalBoxes: params.originalBoxes,
      adjustedBoxes: params.adjustedBoxes,
      totalQuantity: params.totalQuantity,
      unit: params.unit,
    }
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