import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where,
  addDoc as fbAddDoc
} from 'firebase/firestore';
import { IDatabaseService } from './interface';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export class FirebaseDBAdapter implements IDatabaseService {
  private db: any;

  async connect(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (!fs.existsSync(configPath)) {
        throw new Error('firebase-applet-config.json not found');
      }
      
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const app = initializeApp(config);
      this.db = getFirestore(app, config.firestoreDatabaseId);
      logger.info('🔥 FirebaseDBAdapter: Connected to Firestore');
    } catch (error) {
      logger.error('🔥 FirebaseDBAdapter connection error: %o', error);
      throw error;
    }
  }

  async get<T>(collectionName: string, id: string): Promise<T | null> {
    const docRef = doc(this.db, collectionName, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as T) : null;
  }

  async list<T>(collectionName: string, filters?: any[]): Promise<T[]> {
    const colRef = collection(this.db, collectionName);
    let q = query(colRef);

    if (filters) {
      filters.forEach(f => {
        q = query(q, where(f.field, f.operator, f.value));
      });
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  }

  async create<T>(collectionName: string, data: T, id?: string): Promise<string> {
    if (id) {
      await setDoc(doc(this.db, collectionName, id), data as any);
      return id;
    } else {
      const docRef = await fbAddDoc(collection(this.db, collectionName), data as any);
      return docRef.id;
    }
  }

  async update<T>(collectionName: string, id: string, data: Partial<T>): Promise<void> {
    const docRef = doc(this.db, collectionName, id);
    await updateDoc(docRef, data as any);
  }

  async delete(collectionName: string, id: string): Promise<void> {
    const docRef = doc(this.db, collectionName, id);
    await deleteDoc(docRef);
  }
}
