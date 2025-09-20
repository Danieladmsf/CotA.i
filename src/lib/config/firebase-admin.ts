
import * as admin from 'firebase-admin';
import { serviceAccountCredentials } from '../services/serviceAccount';

// This check ensures that the SDK is initialized only once.
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountCredentials),
    });
  } catch (error: any) {
    console.error('Firebase Admin Initialization Error:', error.stack);
  }
}

const adminDb = admin.firestore();

// Export the initialized admin instance and the db instance for use in server actions.
export { adminDb, admin };

    