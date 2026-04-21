import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';

export const signInWithGoogleDeviceAware = async () => {
  if (Capacitor.isNativePlatform()) {
    // Run Native Google Auth via Capacitor Plugin
    const result = await FirebaseAuthentication.signInWithGoogle();
    
    if (result.credential?.idToken) {
      // Create a Firebase credential from the native Google Sign-In response
      const credential = GoogleAuthProvider.credential(
        result.credential.idToken,
        result.credential.accessToken
      );
      
      // Sign in to the Firebase JS SDK with the native credential
      const userCredential = await signInWithCredential(auth, credential);
      return { credential, user: userCredential.user, native: true };
    } else {
      throw new Error("Không nhận được token từ Google Sign-In Native.");
    }
  } else {
    // Run Standard Web Google Auth
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return { credential, user: result.user, native: false };
  }
};

export const signOutDeviceAware = async () => {
  if (Capacitor.isNativePlatform()) {
    await FirebaseAuthentication.signOut();
  }
  await auth.signOut();
};
