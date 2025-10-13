import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/config/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { notifyBrandApprovalPending } from '@/actions/notificationService';

export async function POST(request: NextRequest) {
  console.log('\n==============================================');
  console.log('🔵 API /api/brand-request CHAMADA!');
  console.log('==============================================\n');
  try {
    const body = await request.json();
    console.log('🔵 Body recebido:', JSON.stringify(body, null, 2));
    
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

    // Validate units and price
    if (unitsInPackaging <= 0 || totalPackagingPrice <= 0) {
      return NextResponse.json(
        { error: 'Units and price must be greater than 0' },
        { status: 400 }
      );
    }

    // For unit products, unitWeight can be 0 or missing - default to 1
    const finalUnitWeight = unitWeight && unitWeight > 0 ? Number(unitWeight) : 1;

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
      unitWeight: finalUnitWeight,
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

    // Create notification for the buyer using centralized server-side function
    try {
      console.log('📧 Creating notification for buyer:', { buyerUserId, brandName, productName, productId, quotationId });

      // Fetch quotation name for a better notification message
      let quotationName = `Cotação #${quotationId.slice(-6)}`;
      try {
        const quotationDoc = await db.collection('quotations').doc(quotationId).get();
        if (quotationDoc.exists) {
          const quotationData = quotationDoc.data();
          quotationName = quotationData?.name || quotationName;
        }
      } catch (e) {
        console.warn('⚠️ Failed to fetch quotation name, using fallback:', e);
      }

      // Use the centralized notification service
      const notificationResult = await notifyBrandApprovalPending({
        userId: buyerUserId,
        quotationId,
        quotationName,
        productName,
        brandName,
        supplierName
      });

      if (notificationResult.success) {
        console.log('\n==============================================');
        console.log('✅ NOTIFICAÇÃO CRIADA COM SUCESSO (server-side)!');
        console.log('✅ ID da notificação:', notificationResult.id);
        console.log('✅ Para o usuário:', buyerUserId);
        console.log('✅ Marca:', brandName);
        console.log('✅ Produto:', productName);
        console.log('==============================================\n');
      } else {
        console.error('❌ Erro ao criar notificação (server-side):', notificationResult.error);
      }
    } catch (notificationError: any) {
      console.log('\n==============================================');
      console.error('❌ ERRO AO CRIAR NOTIFICAÇÃO!');
      console.error('❌ Erro:', notificationError.message);
      console.error('❌ Stack:', notificationError.stack);
      console.log('==============================================\n');
      // Non-critical error - don't fail the request
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