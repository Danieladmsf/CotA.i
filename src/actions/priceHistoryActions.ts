'use server';

import { adminDb } from '@/lib/config/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

interface PriceData {
  prices: number[];
  suppliers: string[];
  quotationDate: Date;
}

/**
 * Generates price history records when a quotation is closed.
 * Compares current prices with previous quotation prices and creates history entries for significant changes.
 *
 * @param quotationId The ID of the quotation being closed
 * @param userId The ID of the user who owns the quotation
 * @param quotationDate The date of the quotation
 * @returns The number of price history records created
 */
export async function generatePriceHistoryForQuotation(
  quotationId: string,
  userId: string,
  quotationDate: Date
): Promise<number> {
  try {
    const db = adminDb();
    let historyCount = 0;

    // 1. Get all shopping_list_items for this quotation
    const itemsSnapshot = await db
      .collection('shopping_list_items')
      .where('quotationId', '==', quotationId)
      .where('userId', '==', userId)
      .get();

    if (itemsSnapshot.empty) {
      return 0;
    }

    // 2. Get all offers for this quotation
    const offersSnapshot = await db
      .collection('offers')
      .where('quotationId', '==', quotationId)
      .get();

    if (offersSnapshot.empty) {
      return 0;
    }

    // 3. Group offers by productId (which corresponds to shopping_list_item.id)
    const offersByProduct = new Map<string, Array<{ pricePerUnit: number; supplierName: string }>>();

    offersSnapshot.docs.forEach(offerDoc => {
      const offer = offerDoc.data();
      if (offer.productId && offer.pricePerUnit) {
        if (!offersByProduct.has(offer.productId)) {
          offersByProduct.set(offer.productId, []);
        }
        offersByProduct.get(offer.productId)!.push({
          pricePerUnit: offer.pricePerUnit,
          supplierName: offer.supplierName || ''
        });
      }
    });

    // 4. Get supplies data for category information
    const supplyIds = itemsSnapshot.docs
      .map(doc => doc.data().supplyId)
      .filter(Boolean);

    const suppliesMap = new Map<string, any>();
    if (supplyIds.length > 0) {
      // Fetch in batches of 10 (Firestore 'in' query limit)
      for (let i = 0; i < supplyIds.length; i += 10) {
        const batchIds = supplyIds.slice(i, i + 10);
        const suppliesSnapshot = await db
          .collection('supplies')
          .where('__name__', 'in', batchIds)
          .get();

        suppliesSnapshot.docs.forEach(doc => {
          suppliesMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
      }
    }

    // 5. Process each product and create price history if needed
    for (const itemDoc of itemsSnapshot.docs) {
      const item = itemDoc.data();
      const productId = itemDoc.id;
      const supplyId = item.supplyId;

      if (!supplyId) continue;

      const offers = offersByProduct.get(productId);
      if (!offers || offers.length === 0) continue;

      // Calculate price statistics
      const prices = offers.map(o => o.pricePerUnit);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const suppliers = [...new Set(offers.map(o => o.supplierName).filter(Boolean))];
      const supplier = suppliers[0] || '';

      // Get the most recent price history for this supply
      const previousHistorySnapshot = await db
        .collection('price_history')
        .where('supplyId', '==', supplyId)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      let oldPrice = null;
      let shouldCreate = false;

      if (previousHistorySnapshot.empty) {
        // First time seeing this supply - create history entry without comparison
        shouldCreate = true;
        oldPrice = avgPrice; // Use current price as old_price for first entry
      } else {
        // Compare with previous price
        const previousEntry = previousHistorySnapshot.docs[0].data();
        oldPrice = previousEntry.new_price;

        const priceChange = avgPrice - oldPrice;
        const percentageChange = Math.abs((priceChange / oldPrice) * 100);

        // Only create if change is significant (> 0.5%)
        shouldCreate = percentageChange > 0.5;
      }

      if (shouldCreate) {
        const supply = suppliesMap.get(supplyId);
        const priceChange = avgPrice - oldPrice!;
        const percentageChange = oldPrice! === avgPrice ? 0 : ((priceChange / oldPrice!) * 100);

        await db.collection('price_history').add({
          supplyId: supplyId,
          supplyName: item.name || supply?.name || 'Produto',
          userId: userId,
          old_price: Number(oldPrice!.toFixed(2)),
          new_price: Number(avgPrice.toFixed(2)),
          price_change: Number(priceChange.toFixed(2)),
          percentage_change: Number(percentageChange.toFixed(2)),
          min_price: Number(minPrice.toFixed(2)),
          max_price: Number(maxPrice.toFixed(2)),
          supplier: supplier,
          category: supply?.categoryName || item.categoryName || '',
          date: quotationDate.toISOString(),
          createdAt: Timestamp.fromDate(quotationDate),
          updatedAt: FieldValue.serverTimestamp(),
        });

        historyCount++;
      }
    }

    return historyCount;
  } catch (error: any) {
    console.error('❌ Error generating price history:', error);
    // Don't throw - we don't want price history errors to block quotation closure
    return 0;
  }
}
