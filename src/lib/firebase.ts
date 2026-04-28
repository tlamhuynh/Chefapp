import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  serverTimestamp, 
  Timestamp, 
  writeBatch, 
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// You MUST use the firestoreDatabaseId from the firebase-applet-config.json file
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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
  console.error(`Firebase DB Error [${op}] at ${path}:`, error);
  // Optional: show a toast
};

export const testConnection = async (retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      // Sử dụng getDocFromServer để thực sự kiểm tra kết nối tới server
      await getDocFromServer(doc(db, 'test', 'connection'));
      return true;
    } catch (error: any) {
      // Nếu lỗi là 'insufficient permissions' hoặc 'resource-exhausted' thì vẫn tính là đã kết nối thành công
      if (error.code === 'permission-denied' || error.code === 'resource-exhausted' || error.message?.toLowerCase().includes('quota')) {
        return true;
      }
      
      if (i < retries) {
        console.warn(`Connection attempt ${i + 1} failed, retrying...`, error.code);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      console.error("Connection test failed after retries:", error);
      return false;
    }
  }
  return false;
};
