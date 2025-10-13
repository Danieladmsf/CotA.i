'use server';

import { adminDb } from '@/lib/config/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import {
  notifyBuyerQuantityAdjustmentRequested,
  notifyQuantityAdjustmentApproved,
  notifyQuantityAdjustmentRejected
} from './notificationService';

/**
 * Request a quantity adjustment from the supplier
 * Called by the buyer when they want to adjust the quantities offered
 */
export async function requestQuantityAdjustment(params: {
  notificationId: string; // The original quantity_variation_detected notification
  quotationId: string;
  productId: string;
  offerId: string;
  supplierId: string;
  adjustedBoxes: number;
  adjustedUnitsInPackaging: number;
}) {
  try {
    const db = adminDb();

    // Get the original notification to extract necessary data
    const notificationRef = db.collection('notifications').doc(params.notificationId);
    const notificationDoc = await notificationRef.get();

    if (!notificationDoc.exists) {
      return { success: false, error: 'Notification not found' };
    }

    const notification = notificationDoc.data();

    if (!notification) {
      return { success: false, error: 'Notification data is missing' };
    }

    const metadata = notification.metadata || {};

    // Update the original notification with adjustment request status
    await notificationRef.update({
      'metadata.adjustmentRequested': true,
      'metadata.adjustedBoxes': params.adjustedBoxes,
      'metadata.adjustedUnitsInPackaging': params.adjustedUnitsInPackaging,
      'metadata.adjustmentRequestedAt': Timestamp.now(),
      'metadata.adjustmentStatus': 'pending'
    });

    // Create notification for supplier
    const result = await notifyBuyerQuantityAdjustmentRequested({
      targetSupplierId: params.supplierId,
      quotationId: params.quotationId,
      quotationName: notification.quotationName || `Cotação #${params.quotationId.slice(-6)}`,
      productId: params.productId,
      productName: notification.productName || '',
      brandName: notification.brandName || '',
      originalOfferedBoxes: metadata.offeredQuantity || 0,
      adjustedBoxes: params.adjustedBoxes,
      originalUnitsInPackaging: metadata.unitsInPackaging || 0,
      adjustedUnitsInPackaging: params.adjustedUnitsInPackaging,
      offerId: params.offerId,
      notificationId: params.notificationId
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, message: 'Ajuste solicitado com sucesso' };
  } catch (error: any) {
    console.error('❌ [requestQuantityAdjustment] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle supplier's response to a quantity adjustment request
 * Called by the supplier when they approve or reject the adjustment
 */
export async function handleQuantityAdjustmentResponse(params: {
  supplierNotificationId: string; // The buyer_quantity_adjustment_requested notification
  approved: boolean;
  rejectionReason?: string;
}) {
  try {
    const db = adminDb();

    // Get the supplier notification
    const supplierNotificationRef = db.collection('notifications').doc(params.supplierNotificationId);
    const supplierNotificationDoc = await supplierNotificationRef.get();

    if (!supplierNotificationDoc.exists) {
      return { success: false, error: 'Supplier notification not found' };
    }

    const supplierNotification = supplierNotificationDoc.data();

    if (!supplierNotification) {
      return { success: false, error: 'Supplier notification data is missing' };
    }

    const metadata = supplierNotification.metadata || {};
    const buyerNotificationId = metadata.buyerNotificationId;
    const offerId = metadata.offerId;

    if (!buyerNotificationId) {
      return { success: false, error: 'Buyer notification ID not found' };
    }

    if (!supplierNotification.quotationId || !supplierNotification.productId) {
      return { success: false, error: 'Quotation or product ID not found' };
    }

    // Update supplier notification as read/processed
    await supplierNotificationRef.update({
      isRead: true,
      readAt: Timestamp.now(),
      'metadata.adjustmentApproved': params.approved,
      'metadata.rejectionReason': params.rejectionReason,
      'metadata.processedAt': Timestamp.now()
    });

    // Update the original buyer notification
    const buyerNotificationRef = db.collection('notifications').doc(buyerNotificationId);
    await buyerNotificationRef.update({
      'metadata.adjustmentStatus': params.approved ? 'approved' : 'rejected',
      'metadata.adjustmentProcessedAt': Timestamp.now(),
      'metadata.rejectionReason': params.rejectionReason
    });

    if (params.approved) {
      // Update the offer with new quantities
      const offerRef = db.collection('quotations')
        .doc(supplierNotification.quotationId)
        .collection('products')
        .doc(supplierNotification.productId)
        .collection('offers')
        .doc(offerId);

      const offerDoc = await offerRef.get();

      if (offerDoc.exists) {
        await offerRef.update({
          unitsInPackaging: metadata.adjustedBoxes,
          unitsPerPackage: metadata.adjustedUnitsInPackaging,
          updatedAt: Timestamp.now(),
          adjustmentHistory: FieldValue.arrayUnion({
            adjustedAt: Timestamp.now(),
            originalBoxes: metadata.originalOfferedBoxes,
            originalUnitsInPackaging: metadata.originalUnitsInPackaging,
            newBoxes: metadata.adjustedBoxes,
            newUnitsInPackaging: metadata.adjustedUnitsInPackaging,
            reason: 'buyer_request'
          })
        });
      }

      // Notify buyer of approval
      await notifyQuantityAdjustmentApproved({
        userId: supplierNotification.userId,
        quotationId: supplierNotification.quotationId,
        quotationName: supplierNotification.quotationName || '',
        productId: supplierNotification.productId,
        productName: supplierNotification.productName || '',
        supplierName: supplierNotification.supplierName || '',
        brandName: supplierNotification.brandName || '',
        adjustedBoxes: metadata.adjustedBoxes,
        adjustedUnitsInPackaging: metadata.adjustedUnitsInPackaging,
        notificationId: buyerNotificationId
      });
    } else {
      // Notify buyer of rejection
      await notifyQuantityAdjustmentRejected({
        userId: supplierNotification.userId,
        quotationId: supplierNotification.quotationId,
        quotationName: supplierNotification.quotationName || '',
        productId: supplierNotification.productId,
        productName: supplierNotification.productName || '',
        supplierName: supplierNotification.supplierName || '',
        brandName: supplierNotification.brandName || '',
        rejectionReason: params.rejectionReason,
        notificationId: buyerNotificationId
      });
    }

    return {
      success: true,
      message: params.approved ? 'Ajuste aprovado com sucesso' : 'Ajuste recusado'
    };
  } catch (error: any) {
    console.error('❌ [handleQuantityAdjustmentResponse] Error:', error);
    return { success: false, error: error.message };
  }
}
