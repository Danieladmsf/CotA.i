
import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/config/firebase-admin';
import { serviceAccountCredentials } from '@/lib/services/serviceAccount';

// This API route configures CORS for the Firebase Storage bucket.
// It allows the web app to upload files directly to Storage.
export async function POST(req: NextRequest) {
  try {
    const bucketName = `${serviceAccountCredentials.projectId}.appspot.com`;
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
