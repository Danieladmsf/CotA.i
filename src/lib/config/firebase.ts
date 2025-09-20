
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAuth, type Auth } from "firebase/auth";

// Your web app's Firebase configuration, provided from your project settings
const firebaseConfig = {
  apiKey: "AIzaSyCvAwRaUrnMrrYVzCoq4l0XQ5NffasG2yk",
  authDomain: "cotao-online.firebaseapp.com",
  projectId: "cotao-online",
  storageBucket: "cotao-online.firebasestorage.app",
  messagingSenderId: "613398815464",
  appId: "1:613398815464:web:5b495025fd93a974155f5d"
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);
const auth: Auth = getAuth(app);

// A flag to check if Firebase was initialized (it always will be with this config)
export const isFirebaseInitialized = true;

// Debug function to log Firebase config (without sensitive data)
export const debugFirebaseConfig = () => {
  console.log('🔧 Firebase Debug Info:');
  console.log('- Project ID:', firebaseConfig.projectId);
  console.log('- Auth Domain:', firebaseConfig.authDomain);
  console.log('- Apps initialized:', getApps().length);
  console.log('- Current URL:', window.location.origin);
};

// Export the instances for use in client components
export { db, storage, auth };

// Optionally, export the app instance if needed elsewhere
export default app;
