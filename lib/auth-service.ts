import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithPhoneNumber,
  ApplicationVerifier,
  User,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Platform } from 'react-native';
import { parseFirebaseError } from './auth-errors';

export type UserRole = 'rider' | 'driver' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  role: UserRole;
  createdAt: any;
  updatedAt: any;
}

export class AuthService {
  static async signUpWithEmail(email: string, password: string, displayName: string, role: UserRole = 'rider') {
    try {
      if (!auth || !db) {
        throw new Error('Firebase is not initialized. Please enable Firestore in Firebase Console.');
      }
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName });

      try {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName,
          role,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        console.log('Failed to save user to Firestore, but account created successfully');
      }

      return user;
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      if (error.message?.includes('Cloud Firestore') || error.code?.includes('firestore')) {
        throw new Error('Firebase Firestore is not enabled. Please enable Firestore in Firebase Console or check your internet connection.');
      }
      
      const errorMessage = parseFirebaseError(error);
      throw new Error(errorMessage);
    }
  }

  static async signInWithEmail(email: string, password: string) {
    try {
      if (!auth) {
        throw new Error('Firebase Auth is not initialized. Please check your Firebase configuration.');
      }
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error: any) {
      console.error('Sign in error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      if (error.message?.includes('Cloud Firestore') || error.code?.includes('firestore')) {
        throw new Error('Firebase Firestore is not enabled. Please enable Firestore in Firebase Console or check your internet connection.');
      }
      
      if (error.code === 'auth/api-key-not-valid' || error.message?.includes('api-key-not-valid')) {
        throw new Error('Firebase API key is invalid. Please verify your Firebase project settings in the .env file.');
      }
      
      if (error.code === 'auth/network-request-failed') {
        const platform = Platform.OS === 'web' ? 'web' : 'mobile';
        console.error('❌ Network request failed on platform:', platform);
        
        if (Platform.OS === 'web') {
          const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
          console.error('🌐 Current domain:', currentDomain);
          console.error('📋 Firebase config:', {
            hasAuth: !!auth,
            authDomain: auth?.config?.authDomain,
            projectId: auth?.app?.options?.projectId,
            apiKey: auth?.config?.apiKey ? 'Set' : 'Missing'
          });
          console.error('\n⚠️ PLEASE AUTHORIZE THIS DOMAIN IN FIREBASE CONSOLE:');
          console.error('1. Go to: https://console.firebase.google.com/project/' + auth?.app?.options?.projectId + '/authentication/settings');
          console.error('2. Click "Add domain" under Authorized domains');
          console.error('3. Add: ' + currentDomain);
          console.error('4. Also add: localhost, rork.app');
          console.error('\nℹ️ After adding the domain, refresh this page and try again.\n');
          
          throw new Error('Domain "' + currentDomain + '" is not authorized in Firebase Console. Check the console for instructions.');
        } else {
          throw new Error('Network connection error. Please check your internet connection and try again.');
        }
      }
      
      const errorMessage = parseFirebaseError(error);
      throw new Error(errorMessage);
    }
  }

  static async signInWithGoogle() {
    try {
      if (Platform.OS === 'web') {
        if (!auth || !db) {
          throw new Error('Firebase is not initialized. Please enable Firestore in Firebase Console.');
        }
        
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', user.uid), {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              role: 'rider',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch {
          console.log('Failed to save user to Firestore, but sign in successful');
        }

        return user;
      } else {
        throw new Error('Google Sign In on mobile requires hook usage. Use useGoogleAuth hook instead.');
      }
    } catch (error: any) {
      console.error('Google sign in error:', error);
      
      if (error.message?.includes('Cloud Firestore') || error.code?.includes('firestore')) {
        throw new Error('Firebase Firestore is not enabled. Please enable Firestore in Firebase Console.');
      }
      
      const errorMessage = parseFirebaseError(error);
      throw new Error(errorMessage);
    }
  }

  static async signInWithPhone(phoneNumber: string, appVerifier: ApplicationVerifier) {
    try {
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      return confirmationResult;
    } catch (error: any) {
      console.error('Phone sign in error:', error);
      const errorMessage = parseFirebaseError(error);
      throw new Error(errorMessage);
    }
  }

  static async signOut() {
    try {
      await firebaseSignOut(auth);
    } catch (error: any) {
      console.error('Sign out error:', error);
      const errorMessage = parseFirebaseError(error);
      throw new Error(errorMessage);
    }
  }

  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      if (!db) {
        console.log('Firestore not available, returning null profile');
        return null;
      }
      
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data() as UserProfile;
      }
      return null;
    } catch (error: any) {
      console.error('Get user profile error:', error);
      console.log('Failed to get user profile from Firestore');
      return null;
    }
  }

  static async createMissingUserProfile(uid: string, email: string, displayName: string, role: UserRole) {
    try {
      if (!db) {
        console.log('Firestore not available, skipping profile creation');
        return;
      }
      
      console.log('Creating missing user profile for:', uid);
      await setDoc(doc(db, 'users', uid), {
        uid,
        email,
        displayName,
        role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('User profile created successfully');
    } catch (error: any) {
      console.error('Create missing user profile error:', error);
      throw error;
    }
  }

  static async updateUserProfile(uid: string, data: Partial<UserProfile>) {
    try {
      if (!db) {
        console.log('Firestore not available, skipping profile update');
        return;
      }
      
      await updateDoc(doc(db, 'users', uid), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (error: any) {
      console.error('Update user profile error:', error);
      console.log('Failed to update user profile in Firestore');
    }
  }

  static getCurrentUser(): User | null {
    return auth.currentUser;
  }

  static onAuthStateChanged(callback: (user: User | null) => void) {
    return auth.onAuthStateChanged(callback);
  }
}
