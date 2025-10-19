
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, admin, isAdminInitialized } from '@/lib/config/firebase-admin';
import type { IncomingMessage } from '@/types';

// This API route is now a generic message queueing endpoint.
const MESSAGES_COLLECTION = 'incoming_messages';

export async function POST(req: NextRequest) {
  console.log(`[API/send-whatsapp] Received a new POST request.`);

  // Check if Firebase Admin is initialized
  if (!isAdminInitialized) {
    console.warn(`[API/send-whatsapp] Firebase Admin not initialized. Check environment variables.`);
    return NextResponse.json({
      error: 'WhatsApp service temporarily unavailable. Please try again later.'
    }, { status: 503 });
  }

  let requestBody;
  try {
    requestBody = await req.json();
    console.log(`[API/send-whatsapp] Request body parsed:`, requestBody);
  } catch (error) {
    console.error(`[API/send-whatsapp] Error parsing JSON body:`, error);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { phoneNumber, message, userId, supplierName } = requestBody;

  if (!phoneNumber || !message || !userId) {
    console.warn(`[API/send-whatsapp] Bad request: phoneNumber, message or userId missing.`);
    return NextResponse.json({ error: 'phoneNumber, message, and userId are required.' }, { status: 400 });
  }

  const cleanedPhoneNumber = String(phoneNumber).replace(/\D/g, '');

  try {
    console.log(`[API/send-whatsapp] Adding message to Firestore outgoing queue for ${cleanedPhoneNumber}...`);

    const db = adminDb();
    const messageEntry: Omit<IncomingMessage, 'id'> = {
        isOutgoing: true,
        phoneNumber: cleanedPhoneNumber,
        supplierName: supplierName || 'N/A',
        message: message,
        status: 'pending',
        userId: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection(MESSAGES_COLLECTION).add(messageEntry);
    console.log(`[API/send-whatsapp] Message successfully queued with ID: ${docRef.id}`);

    return NextResponse.json({ success: true, message: 'Message queued successfully.' });

  } catch (error: any) {
    console.error(`[API/send-whatsapp] Firestore Error: Failed to add message to queue for ${cleanedPhoneNumber}. Error: ${error.message}`);
    return NextResponse.json({ error: 'Failed to queue message.', details: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
    return NextResponse.json({ status: 'ok', message: 'This endpoint is for queueing WhatsApp messages via POST.' });
}
