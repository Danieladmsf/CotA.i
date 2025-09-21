import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAuth, Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

const isFirebaseInitialized = firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId;

console.log('🔥 Firebase Config: Checking initialization...');
console.log('🔥 Firebase Config: API Key present?', !!firebaseConfig.apiKey);
console.log('🔥 Firebase Config: Auth Domain present?', !!firebaseConfig.authDomain);
console.log('🔥 Firebase Config: Project ID present?', !!firebaseConfig.projectId);
console.log('🔥 Firebase Config: Firebase initialized?', isFirebaseInitialized);

if (isFirebaseInitialized) {
  console.log('🔥 Firebase Config: Initializing Firebase...');
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    console.log('🔥 Firebase Config: Firebase app initialized successfully');
  } else {
    app = getApp();
    console.log('🔥 Firebase Config: Using existing Firebase app');
  }
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  console.log('🔥 Firebase Config: All Firebase services initialized');
} else {
  console.error("🔥 Firebase Config: Firebase environment variables are not set. Firebase is not initialized.");
  console.error("🔥 Firebase Config: Missing variables:", {
    apiKey: !firebaseConfig.apiKey,
    authDomain: !firebaseConfig.authDomain,
    projectId: !firebaseConfig.projectId,
    storageBucket: !firebaseConfig.storageBucket,
    messagingSenderId: !firebaseConfig.messagingSenderId,
    appId: !firebaseConfig.appId
  });
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
  storage = {} as FirebaseStorage;
}

// Debug function for troubleshooting Firebase configuration
export const debugFirebaseConfig = () => {
  console.log('=== Firebase Configuration Debug ===');
  console.log('Environment Variables:');
  console.log('- NEXT_PUBLIC_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '[SET]' : '[NOT SET]');
  console.log('- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '[NOT SET]');
  console.log('- NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '[NOT SET]');
  console.log('- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '[NOT SET]');
  console.log('- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:', process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '[NOT SET]');
  console.log('- NEXT_PUBLIC_FIREBASE_APP_ID:', process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '[NOT SET]');
  console.log('Firebase Initialized:', isFirebaseInitialized);
  console.log('======================================');
};

export { db, storage, auth, app, isFirebaseInitialized };