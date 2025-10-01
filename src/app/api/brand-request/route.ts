import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/config/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received brand request body:', body); // DIAGNOSTIC LOG
    
    const {
      quotationId,
      productId,
      supplierId,
      supplierName,
      supplierInitials,
      brandName,
      packagingDescription,
      unitsInPackaging,
      totalPackagingPrice,
      pricePerUnit,
      imageUrl,
      imageFileName,
      buyerUserId, // Changed from userId
      sellerUserId // Added
    } = body;

    // Validate required fields
    if (!quotationId || !productId || !supplierId || !brandName || !packagingDescription || !buyerUserId || !sellerUserId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (unitsInPackaging <= 0 || totalPackagingPrice <= 0) {
      return NextResponse.json(
        { error: 'Units and price must be greater than 0' },
        { status: 400 }
      );
    }

    // Create the brand request document
    const brandRequest = {
      quotationId,
      productId,
      supplierId,
      supplierName,
      supplierInitials,
      brandName: brandName.trim(),
      packagingDescription: packagingDescription.trim(),
      unitsInPackaging: Number(unitsInPackaging),
      totalPackagingPrice: Number(totalPackagingPrice),
      pricePerUnit: Number(pricePerUnit),
      imageUrl: imageUrl || '',
      imageFileName: imageFileName || '',
      status: 'pending',
      buyerUserId, // Changed from userId
      sellerUserId, // Added
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    // Save to Firestore using admin SDK (bypasses security rules)
    const db = adminDb();
    const docRef = await db.collection('pending_brand_requests').add(brandRequest);

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
