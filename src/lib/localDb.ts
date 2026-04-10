
// Local Storage based Database to replace Firebase for offline/local-only use
export class LocalDb {
  private static listeners: Map<string, ((data: any) => void)[]> = new Map();

  private static getStorageKey(collectionName: string): string {
    return `chefchat_db_${collectionName}`;
  }

  static async getCollection(name: string): Promise<any[]> {
    const data = localStorage.getItem(this.getStorageKey(name));
    return data ? JSON.parse(data) : [];
  }

  static async saveCollection(name: string, data: any[]) {
    localStorage.setItem(this.getStorageKey(name), JSON.stringify(data));
    this.notify(name);
  }

  static subscribe(name: string, callback: (data: any) => void) {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, []);
    }
    this.listeners.get(name)?.push(callback);
    
    // Initial call
    this.getCollection(name).then(callback);

    return () => {
      const list = this.listeners.get(name) || [];
      this.listeners.set(name, list.filter(l => l !== callback));
    };
  }

  private static reconstructTimestamps(item: any) {
    if (!item) return item;
    const newItem = { ...item };
    if (newItem.timestamp && typeof newItem.timestamp === 'string') {
      const date = new Date(newItem.timestamp);
      newItem.timestamp = {
        toDate: () => date,
        toMillis: () => date.getTime()
      };
    }
    if (newItem.createdAt && typeof newItem.createdAt === 'string') {
      const date = new Date(newItem.createdAt);
      newItem.createdAt = {
        toDate: () => date,
        toMillis: () => date.getTime()
      };
    }
    if (newItem.updatedAt && typeof newItem.updatedAt === 'string') {
      const date = new Date(newItem.updatedAt);
      newItem.updatedAt = {
        toDate: () => date,
        toMillis: () => date.getTime()
      };
    }
    return newItem;
  }

  private static notify(name: string) {
    const list = this.listeners.get(name) || [];
    this.getCollection(name).then(data => {
      const processedData = data.map(item => this.reconstructTimestamps(item));
      list.forEach(callback => callback(processedData));
    });
  }

  static async addDoc(collectionName: string, data: any): Promise<string> {
    const id = Math.random().toString(36).substring(2, 15);
    const collection = await this.getCollection(collectionName);
    const processedData = { ...data };
    Object.keys(processedData).forEach(key => {
      if (processedData[key] && typeof processedData[key].toDate === 'function') {
        processedData[key] = processedData[key].toDate().toISOString();
      }
    });
    const newDoc = { ...processedData, id, timestamp: new Date().toISOString() };
    collection.push(newDoc);
    await this.saveCollection(collectionName, collection);
    return id;
  }

  static async setDoc(collectionName: string, docId: string, data: any) {
    const collection = await this.getCollection(collectionName);
    const index = collection.findIndex(d => d.id === docId);
    const processedData = { ...data };
    Object.keys(processedData).forEach(key => {
      if (processedData[key] && typeof processedData[key].toDate === 'function') {
        processedData[key] = processedData[key].toDate().toISOString();
      }
    });
    const newDoc = { ...processedData, id: docId, timestamp: new Date().toISOString() };
    if (index >= 0) {
      collection[index] = newDoc;
    } else {
      collection.push(newDoc);
    }
    await this.saveCollection(collectionName, collection);
  }

  static async updateDoc(collectionName: string, docId: string, data: any) {
    const collection = await this.getCollection(collectionName);
    const index = collection.findIndex(d => d.id === docId);
    if (index >= 0) {
      const processedData = { ...data };
      Object.keys(processedData).forEach(key => {
        if (processedData[key] && typeof processedData[key].toDate === 'function') {
          processedData[key] = processedData[key].toDate().toISOString();
        }
      });
      collection[index] = { ...collection[index], ...processedData };
      await this.saveCollection(collectionName, collection);
    }
  }

  static async deleteDoc(collectionName: string, docId: string) {
    const collection = await this.getCollection(collectionName);
    const filtered = collection.filter(d => d.id !== docId);
    await this.saveCollection(collectionName, filtered);
  }

  static async getDoc(collectionName: string, docId: string) {
    const collection = await this.getCollection(collectionName);
    const item = collection.find(d => d.id === docId);
    return this.reconstructTimestamps(item);
  }
}

// Mock Auth
export const mockUser = {
  uid: 'local-user-123',
  email: 'local@chefchat.app',
  displayName: 'Đầu Bếp Local',
  photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chef',
  emailVerified: true,
  isAnonymous: false,
  providerData: []
};

export const localAuth = {
  currentUser: mockUser,
  onAuthStateChanged: (callback: (user: any) => void) => {
    setTimeout(() => callback(mockUser), 100);
    return () => {};
  },
  signOut: async () => {
    console.log("Signed out from local");
  }
};
