import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirestore, doc, collection, onSnapshot, query, orderBy, setDoc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, getDocFromServer, Firestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Helper to remove undefined properties for Firestore
export function cleanForFirestore(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result: any = Array.isArray(obj) ? [] : {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      if (obj[key] && typeof obj[key] === 'object') {
        const cleaned = cleanForFirestore(obj[key]);
        if (Array.isArray(result)) {
          result.push(cleaned);
        } else {
          result[key] = cleaned;
        }
      } else {
        if (Array.isArray(result)) {
          result.push(obj[key]);
        } else {
          result[key] = obj[key];
        }
      }
    }
  });
  return result;
}

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', errInfo);
  if (error instanceof Error) {
    alert(`Erreur Base de données (${operationType}):\n${error.message}`);
  } else {
    alert(`Erreur Base de données (${operationType}):\n${String(error)}`);
  }
}

// Validate connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

export { 
  signInWithPopup, 
  onAuthStateChanged, 
  doc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs
};
export type { User };
