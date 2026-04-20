import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup as fbSignInWithPopup, signOut as fbSignOut, onAuthStateChanged as fbOnAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  collection as fbCollection, 
  doc as fbDoc, 
  addDoc as fbAddDoc, 
  setDoc as fbSetDoc, 
  updateDoc as fbUpdateDoc, 
  deleteDoc as fbDeleteDoc, 
  getDoc as fbGetDoc, 
  getDocs as fbGetDocs, 
  query as fbQuery, 
  where as fbWhere, 
  orderBy as fbOrderBy, 
  limit as fbLimit, 
  onSnapshot as fbOnSnapshot, 
  serverTimestamp as fbServerTimestamp,
  Timestamp as fbTimestamp,
  writeBatch as fbWriteBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`Firestore Error [${operationType}] at ${path}:`, error);
}

export async function testConnection() {
  try {
    const { doc, getDocFromServer } = await import('firebase/firestore');
    await getDocFromServer(doc(db, '_connection_test', 'test'));
    console.log("Firestore connection test: success (or at least connected to server)");
  } catch (error) {
    console.warn("Firestore connection test warning:", error);
  }
}

// Firestore API Wrappers
export const collection = (db: any, path: string) => fbCollection(db, path);
export const doc = (db: any, path: string, id?: string) => id ? fbDoc(db, path, id) : fbDoc(fbCollection(db, path));
export const query = fbQuery;
export const where = fbWhere;
export const orderBy = fbOrderBy;
export const limit = fbLimit;
export const addDoc = fbAddDoc;
export const setDoc = fbSetDoc;
export const updateDoc = fbUpdateDoc;
export const deleteDoc = fbDeleteDoc;
export const getDoc = fbGetDoc;
export const getDocs = fbGetDocs;
export const onSnapshot = fbOnSnapshot;
export const serverTimestamp = fbServerTimestamp;
export const Timestamp = fbTimestamp;
export const writeBatch = fbWriteBatch;

export const getDocFromServer = fbGetDoc;
export const signInWithPopup = fbSignInWithPopup;
export const signOut = fbSignOut;
export const onAuthStateChanged = fbOnAuthStateChanged;

export type User = import('firebase/auth').User;
