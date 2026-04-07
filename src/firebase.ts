import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  getDocFromServer,
  getDocs,
  initializeFirestore,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Helper to remove undefined properties for Firestore
export function cleanForFirestore(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const result: any = Array.isArray(obj) ? [] : {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      if (obj[key] && typeof obj[key] === 'object') {
        const cleaned = cleanForFirestore(obj[key]);
        if (Array.isArray(result)) {
          result.push(cleaned);
        } else {
          result[key] = cleaned;
        }
      } else if (Array.isArray(result)) {
        result.push(obj[key]);
      } else {
        result[key] = obj[key];
      }
    }
  });
  return result;
}

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: false,
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
  };
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
      providerInfo: auth.currentUser?.providerData.map((provider) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL,
      })) || [],
    },
    operationType,
    path,
  };

  console.groupCollapsed(`[StudioDebug][firestore] ${operationType.toUpperCase()} ${path || '(unknown path)'}`);
  console.error('Firestore Error:', errInfo);
  if (error instanceof Error) {
    console.error('Firestore Error Message:', error.message);
  }
  console.trace('Firestore call trace');
  console.groupEnd();
}

// Validate connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export {
  signInWithPopup,
  onAuthStateChanged,
  doc,
  collection,
  collectionGroup,
  onSnapshot,
  query,
  where,
  orderBy,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
};
export type { Firestore, User };
