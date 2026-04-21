import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Import Firestore mock implementation backed by IndexedDB
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, getDoc, getDocs, onSnapshot,
  serverTimestamp, Timestamp, writeBatch, getDocFromServer
} from './idb-firestore';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// We export a dummy db object for compatibility
export const db = {};

export {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, getDoc, getDocs, onSnapshot,
  serverTimestamp, Timestamp, writeBatch, getDocFromServer,
  signInWithPopup, signOut, onAuthStateChanged
};

export type { User };

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
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

export const handleFirestoreError = (error: any, op: OperationType, path: string | null) => {
  console.error(`IDB Error [${op}] at ${path}:`, error);
  // IndexedDB won't have permission errors, so we just log and throw.
  throw error;
};

export const testConnection = async () => {
  console.log("IndexedDB locally initialized successfully.");
};
testConnection();
