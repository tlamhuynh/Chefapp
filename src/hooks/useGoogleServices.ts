import { useState } from 'react';
import { auth, googleProvider, signInWithPopup } from '../lib/firebase';

export function useGoogleServices() {
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  const connectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      if (typeof (googleProvider as any).addScope === 'function') {
        (googleProvider as any).addScope('https://www.googleapis.com/auth/drive.readonly');
        (googleProvider as any).addScope('https://www.googleapis.com/auth/photoslibrary.readonly');
      }
      const result = await signInWithPopup(auth, googleProvider);
      const credential = (result as any)._credential;
      if (credential?.accessToken) {
        setGoogleToken(credential.accessToken);
      }
    } catch (error) {
      console.error("Google connection failed", error);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const searchDrive = async (searchQuery: string) => {
    if (!googleToken) return "Vui lòng kết nối Google Drive trước.";
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=name contains '${searchQuery}' and mimeType != 'application/vnd.google-apps.folder'&fields=files(id, name, webViewLink)`, {
        headers: { 'Authorization': `Bearer ${googleToken}` }
      });
      const data = await response.json();
      if (data.files?.length > 0) {
        return `Tôi tìm thấy ${data.files.length} tệp tin trong Drive:\n` + 
          data.files.map((f: any) => `- [${f.name}](${f.webViewLink})`).join('\n');
      }
      return "Không tìm thấy tệp tin liên quan.";
    } catch (error) {
      console.error("Drive search failed", error);
      return "Lỗi tìm kiếm Drive.";
    }
  };

  const searchPhotos = async (searchQuery: string) => {
    if (!googleToken) return "Vui lòng kết nối Google Photos trước.";
    try {
      const response = await fetch(`https://photoslibrary.googleapis.com/v1/mediaItems:search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pageSize: 6,
          filters: { contentFilter: { includedContentCategories: ['FOOD'] } }
        })
      });
      const data = await response.json();
      if (data.mediaItems?.length > 0) {
        const photos = data.mediaItems.map((m: any) => ({ url: `${m.baseUrl}=w800-h800`, filename: m.filename }));
        return `Tìm thấy ${photos.length} hình ảnh món ăn: ${JSON.stringify(photos)}`;
      }
      return "Không tìm thấy hình ảnh tương ứng.";
    } catch (error) {
      console.error("Photos search failed", error);
      return "Lỗi tìm kiếm Photos.";
    }
  };

  const searchKeep = async (searchQuery: string) => {
    return "Tính năng Google Keep đang phát triển.";
  };

  return { googleToken, connectGoogle, searchDrive, searchPhotos, searchKeep, isConnectingGoogle };
}
