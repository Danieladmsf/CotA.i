import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/config/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received brand request body:', body);
    
    const {
      quotationId,
      productId,
      productName, // ADDED
      supplierId,
      supplierName,
      supplierInitials,
      brandName,
      packagingDescription,
      unitsInPackaging,
      unitsPerPackage, // ADDED for new field
      unitWeight,
      totalPackagingPrice,
      pricePerUnit,
      imageUrl,
      imageFileName,
      buyerUserId,
      sellerUserId
    } = body;

    // Validate required fields
    if (!quotationId || !productId || !productName || !supplierId || !brandName || !packagingDescription || !buyerUserId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (unitsInPackaging <= 0 || unitWeight <= 0 || totalPackagingPrice <= 0) {
      return NextResponse.json(
        { error: 'Units, weight and price must be greater than 0' },
        { status: 400 }
      );
    }

    // Validate pricePerUnit
    const pricePerUnitNumber = Number(pricePerUnit);
    if (!pricePerUnit || isNaN(pricePerUnitNumber) || !isFinite(pricePerUnitNumber)) {
      return NextResponse.json(
        { error: 'Invalid price per unit calculation' },
        { status: 400 }
      );
    }

    // Create the brand request document
    const brandRequest = {
      quotationId,
      productId,
      productName, // ADDED
      supplierId,
      supplierName,
      supplierInitials,
      brandName: brandName.trim(),
      packagingDescription: packagingDescription.trim(),
      unitsInPackaging: Number(unitsInPackaging),
      unitsPerPackage: unitsPerPackage ? Number(unitsPerPackage) : Number(unitsInPackaging), // Use unitsPerPackage if provided, otherwise use unitsInPackaging for backward compatibility
      unitWeight: Number(unitWeight),
      totalPackagingPrice: Number(totalPackagingPrice),
      pricePerUnit: pricePerUnitNumber,
      imageUrl: imageUrl || '',
      imageFileName: imageFileName || '',
      status: 'pending',
      buyerUserId,
      sellerUserId: sellerUserId || supplierId, // Fallback to supplierId if sellerUserId not provided
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    // Save to Firestore using admin SDK
    const db = adminDb();
    const docRef = await db.collection('pending_brand_requests').add(brandRequest);

    // Create notification for the buyer
    try {
      console.log('📧 Creating notification for buyer:', { buyerUserId, brandName, productName });

      const notificationData = {
        userId: buyerUserId,
        type: 'brand_approval_pending',
        title: 'Nova marca para aprovação',
        message: `${supplierName} enviou a marca "${brandName}" para aprovação no produto "${productName}".`,
        quotationId,
        productId,
        brandName,
        productName,
        supplierId,
        entityId: docRef.id, // Link to the brand request
        isRead: false,
        priority: 'high',
        actionUrl: `/cotacao?quotation=${quotationId}&tab=aprovacoes`,
        createdAt: Timestamp.now()
      };

      console.log('📧 Notification data:', notificationData);

      const notificationRef = await db.collection('notifications').add(notificationData);
      console.log('✅ Notification created successfully:', {
        buyerUserId,
        notificationId: notificationRef.id,
        type: 'brand_approval_pending',
        brandName,
        productName
      });
    } catch (notificationError) {
      console.error('⚠️ Error creating notification for buyer:', notificationError);
      // Don't fail the whole request if notification fails
    }

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: 'Brand request created successfully'
    });

  } catch (error: any) {
    console.error('Error creating brand request:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}