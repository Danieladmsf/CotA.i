
import * as admin from 'firebase-admin';

const getAdminDb = () => {
  // If the app is already initialized, return the existing firestore instance
  if (admin.apps.length > 0) {
    // This assertion is safe because if apps.length > 0, an app is initialized.
    return admin.firestore();
  }

  try {
    // If not initialized, initialize it now
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    // Debug logs to identify missing variables

    if (!projectId || !privateKey || !clientEmail) {
      throw new Error('Firebase Admin: Missing required environment variables.');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        privateKey: privateKey.replace(/\\n/g, '\n'),
        clientEmail: clientEmail,
      }),
      projectId: projectId,
    });

    return admin.firestore();
  } catch (error: any) {
    console.error('Firebase Admin Initialization Error:', error.message);
    // Re-throw the error to make it clear that the DB is not available
    throw new Error(`Firebase Admin could not be initialized: ${error.message}`);
  }
};

// We can also export admin for other uses if needed
const isAdminInitialized = admin.apps.length > 0;

// Export the safe db getter and other utilities
export { getAdminDb as adminDb, admin, isAdminInitialized };