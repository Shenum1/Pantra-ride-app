import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, CACHE_SIZE_UNLIMITED, connectFirestoreEmulator, enableNetwork, disableNetwork } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase configuration is missing. Please check your .env file.');
  console.error('Current config:', {
    apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'MISSING',
    authDomain: firebaseConfig.authDomain || 'MISSING',
    projectId: firebaseConfig.projectId || 'MISSING',
  });
}

if (Platform.OS === 'web') {
  console.log('🌐 Web Platform Detected');
  console.log('ℹ️ Please ensure your domain is authorized in Firebase Console:');
  console.log('   1. Go to: https://console.firebase.google.com/project/' + firebaseConfig.projectId + '/authentication/settings');
  console.log('   2. Scroll to "Authorized domains"');
  console.log('   3. Add: localhost, rork.app, and any other domains you use');
  console.log('   Current domain:', typeof window !== 'undefined' ? window.location.hostname : 'unknown');
}

let app;
let auth: Auth;
let db: any;
let storage: any;

try {
  if (getApps().length === 0) {
    console.log('🔵 Initializing Firebase...');
    console.log('Config check:', {
      hasApiKey: !!firebaseConfig.apiKey,
      hasAuthDomain: !!firebaseConfig.authDomain,
      hasProjectId: !!firebaseConfig.projectId,
      platform: Platform.OS,
    });

    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase app initialized');
    
    auth = getAuth(app);
    console.log('✅ Firebase auth initialized');
    
    try {
      if (Platform.OS === 'web') {
        db = initializeFirestore(app, {
          experimentalForceLongPolling: true,
          ignoreUndefinedProperties: true,
        });
      } else {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache({ 
            tabManager: persistentMultipleTabManager(),
            cacheSizeBytes: CACHE_SIZE_UNLIMITED 
          }),
        });
      }
      console.log('✅ Firestore initialized');
    } catch (firestoreError: any) {
      console.error('⚠️ Firestore initialization failed:', firestoreError.message);
      console.log('Attempting to get existing Firestore instance...');
      db = getFirestore(app);
      console.log('✅ Using existing Firestore instance');
    }
    
    storage = getStorage(app);
    console.log('✅ Firebase storage initialized');
    
    console.log('✅ Firebase initialized successfully');
    console.log('Platform:', Platform.OS);
    console.log('Project ID:', firebaseConfig.projectId);
    console.log('Auth Domain:', firebaseConfig.authDomain);
    console.log('\n⚠️ IMPORTANT: If you see Firestore connection errors:');
    console.log('   1. Go to: https://console.firebase.google.com/project/' + firebaseConfig.projectId + '/firestore');
    console.log('   2. Click "Create Database"');
    console.log('   3. Choose "Start in test mode" (or production mode with rules)');
    console.log('   4. Select a location (e.g., us-central)');
    console.log('   5. Click "Enable"\n');
  } else {
    app = getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log('✅ Firebase already initialized, using existing instance');
  }
} catch (error: any) {
  console.error('❌ Firebase initialization error:', error);
  console.error('Error details:', {
    message: error.message,
    code: error.code,
    stack: error.stack,
  });
  
  if (getApps().length > 0) {
    console.log('⚠️ Attempting to use existing Firebase app...');
    app = getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log('✅ Using existing Firebase instances');
  } else {
    console.error('❌ Cannot initialize Firebase - critical error');
    throw new Error(`Failed to initialize Firebase: ${error.message}`);
  }
}

export { app, auth, db, storage };
