
import { NextRequest, NextResponse } from 'next/server';
import { admin, isAdminInitialized } from '@/lib/config/firebase-admin';

// This API route configures CORS for the Firebase Storage bucket.
// It allows the web app to upload files directly to Storage.
export async function POST(req: NextRequest) {
  // Check if Firebase Admin is initialized
  if (!isAdminInitialized) {
    console.warn('Firebase Admin not initialized. Cannot setup CORS.');
    return NextResponse.json({
      success: false,
      error: 'Firebase Admin service unavailable. Check environment variables.'
    }, { status: 503 });
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'Project ID not found in environment variables.'
      }, { status: 400 });
    }

    const bucketName = `${projectId}.appspot.com`;
    const bucket = admin.storage().bucket(bucketName);

    const corsConfiguration = [
      {
        origin: ["*"], // Allows all origins, you can restrict this to your app's domain
        method: ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
        responseHeader: [
          "Content-Type",
          "Access-Control-Allow-Origin",
          "x-goog-resumable"
        ],
        maxAgeSeconds: 3600,
      },
    ];

    await bucket.setCorsConfiguration(corsConfiguration);

    console.log(`CORS configuration set for bucket ${bucketName}`);
    return NextResponse.json({ success: true, message: `CORS configuration updated successfully for bucket ${bucketName}.` });
  } catch (error: any) {
    console.error('Error setting CORS configuration:', error);
    return NextResponse.json({ success: false, error: 'Failed to set CORS configuration.', details: error.message }, { status: 500 });
  }
}
