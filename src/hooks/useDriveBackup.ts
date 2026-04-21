import { useState } from 'react';
import { auth, db, collection, query, where, getDocs } from '../lib/firebase';
import { GoogleAuthProvider } from 'firebase/auth';

let cachedDriveToken: string | null = null;
let tokenExpiry: number = 0;

export async function fetchAllBackupData() {
  if (!auth.currentUser) throw new Error("Chưa đăng nhập");
  const uid = auth.currentUser.uid;
      
  const recipesSnap = await getDocs(query(collection(db, 'recipes'), where('authorId', '==', uid)));
  const inventorySnap = await getDocs(query(collection(db, 'inventory'), where('authorId', '==', uid)));
  const chatsSnap = await getDocs(query(collection(db, 'chats'), where('userId', '==', uid)));
  
  return {
    timestamp: new Date().toISOString(),
    user: {
      email: auth.currentUser.email,
      uid: uid
    },
    recipes: recipesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
    inventory: inventorySnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
    chats: chatsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
  };
}

export async function uploadDataToDrive(token: string, backupData: any) {
  const fileContent = JSON.stringify(backupData, null, 2);
  const blob = new Blob([fileContent], { type: 'application/json' });

  const metadata = {
    name: `SousChef_Backup_${new Date().toISOString().split('T')[0]}.json`,
    mimeType: 'application/json',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: form
  });

  if (!response.ok) {
    throw new Error("Lỗi khi tải file lên Google Drive.");
  }
}

export function useDriveBackup() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  const performBackup = async () => {
    if (!auth.currentUser) return;
    setIsBackingUp(true);
    setBackupStatus('Đang xác thực bảo mật...');
    
    try {
      // 1. Get Google OAuth Token with Drive scope
      let token: string | undefined;
      
      const { signInWithGoogleDeviceAware } = await import('../lib/auth-native');
      const { credential } = await signInWithGoogleDeviceAware();
      token = credential?.accessToken;

      if (!token) {
        throw new Error("Không lấy được quyền truy cập Google Drive.");
      }
      
      // Cache the token for background auto-backup (valid for ~1hr)
      cachedDriveToken = token;
      tokenExpiry = Date.now() + 3500 * 1000;

      setBackupStatus('Đang thu thập dữ liệu từ đám mây...');
      const backupData = await fetchAllBackupData();

      setBackupStatus('Đang tạo tệp sao lưu trên Google Drive...');
      await uploadDataToDrive(token, backupData);

      setBackupStatus('✅ Sao lưu thành công! Đã lưu vào Google Drive của bạn.');
      setTimeout(() => setBackupStatus(null), 5000);

    } catch (error: any) {
      console.error("Backup failed", error);
      setBackupStatus(`❌ Lỗi sao lưu: ${error.message || 'Chưa rõ'}`);
      setTimeout(() => setBackupStatus(null), 7000);
    } finally {
      setIsBackingUp(false);
    }
  };

  return { performBackup, isBackingUp, backupStatus };
}

// Background auto backup helper
let isAutoBackingUp = false;
export async function performAutoBackup() {
  if (isAutoBackingUp || !cachedDriveToken || Date.now() > tokenExpiry) return;
  isAutoBackingUp = true;
  try {
    const backupData = await fetchAllBackupData();
    await uploadDataToDrive(cachedDriveToken, backupData);
    console.log("Auto-backup to Google Drive successful.");
    localStorage.setItem('last_auto_backup', new Date().toISOString());
  } catch (err) {
    console.error("Auto backup failed", err);
  } finally {
    isAutoBackingUp = false;
  }
}
