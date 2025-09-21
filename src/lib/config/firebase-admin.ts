
import * as admin from 'firebase-admin';

// Check if Firebase Admin is already initialized
let isAdminInitialized = false;
let adminDb: admin.firestore.Firestore | null = null;

// Function to safely initialize Firebase Admin
const initializeFirebaseAdmin = () => {
  if (isAdminInitialized || admin.apps.length > 0) {
    return;
  }

  try {
    // Check if we have the required environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId || !privateKey || !clientEmail) {
      console.warn('Firebase Admin: Missing required environment variables. Admin features disabled.');
      return;
    }

    const serviceAccountCredentials = {
      type: "service_account",
      project_id: projectId,
      private_key: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
      client_email: clientEmail,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountCredentials as admin.ServiceAccount),
      projectId: projectId,
    });

    adminDb = admin.firestore();
    isAdminInitialized = true;
    console.log('Firebase Admin initialized successfully');
  } catch (error: any) {
    console.error('Firebase Admin Initialization Error:', error.message);
    console.warn('Firebase Admin features will be disabled');
  }
};

// Initialize on module load
initializeFirebaseAdmin();

// Safe getter for adminDb
const getAdminDb = () => {
  if (!adminDb) {
    throw new Error('Firebase Admin is not initialized. Please check your environment variables.');
  }
  return adminDb;
};

// Export the initialized admin instance and safe db getter
export { getAdminDb as adminDb, admin, isAdminInitialized };

    