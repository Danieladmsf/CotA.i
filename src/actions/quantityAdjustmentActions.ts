'use server';

import { adminDb } from '@/lib/config/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import {
  notifySellerOfBuyerAdjustment
} from './notificationService';

/**
 * Apply a quantity adjustment directly to the supplier's offer
 * Called by the buyer when they want to adjust the quantities offered
 * The adjustment is applied immediately without requiring supplier approval
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

    // Get the offer to calculate total quantity
    const offerRef = db.collection('quotations')
      .doc(params.quotationId)
      .collection('products')
      .doc(params.productId)
      .collection('offers')
      .doc(params.offerId);

    const offerDoc = await offerRef.get();

    if (!offerDoc.exists) {
      return { success: false, error: 'Offer not found' };
    }

    const offerData = offerDoc.data();

    // Calculate total quantity (boxes * unitsInPackaging * weight per unit)
    const totalQuantity = params.adjustedBoxes * params.adjustedUnitsInPackaging * (offerData?.weightPerUnit || 1);

    // Update the offer directly with new quantities
    await offerRef.update({
      unitsInPackaging: params.adjustedBoxes,
      unitsPerPackage: params.adjustedUnitsInPackaging,
      updatedAt: Timestamp.now(),
      adjustmentHistory: FieldValue.arrayUnion({
        adjustedAt: Timestamp.now(),
        originalBoxes: metadata.offeredQuantity || offerData?.unitsInPackaging || 0,
        originalUnitsInPackaging: metadata.unitsInPackaging || offerData?.unitsPerPackage || 0,
        newBoxes: params.adjustedBoxes,
        newUnitsInPackaging: params.adjustedUnitsInPackaging,
        reason: 'buyer_adjustment',
        adjustedBy: 'buyer'
      })
    });

    // Update the original notification to mark it as applied
    // Note: We don't mark as read here - user should manually review
    await notificationRef.update({
      'metadata.adjustmentApplied': true,
      'metadata.adjustedBoxes': params.adjustedBoxes,
      'metadata.adjustedUnitsInPackaging': params.adjustedUnitsInPackaging,
      'metadata.adjustedWeightPerUnit': offerData?.weightPerUnit || 1,
      'metadata.adjustedTotalQuantity': totalQuantity,
      'metadata.adjustmentAppliedAt': Timestamp.now(),
      'metadata.adjustmentStatus': 'applied'
    });

    // Notify supplier that their offer was adjusted
    const result = await notifySellerOfBuyerAdjustment({
      targetSupplierId: params.supplierId,
      quotationId: params.quotationId,
      productName: notification.productName || '',
      brandName: notification.brandName || '',
      originalBoxes: metadata.offeredQuantity || offerData?.unitsInPackaging || 0,
      adjustedBoxes: params.adjustedBoxes,
      totalQuantity: totalQuantity,
      unit: offerData?.unit || 'un'
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, message: 'Oferta ajustada com sucesso' };
  } catch (error: any) {
    console.error('❌ [requestQuantityAdjustment] Error:', error);
    return { success: false, error: error.message };
  }
}

