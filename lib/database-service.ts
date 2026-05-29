import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  addDoc,
  serverTimestamp,
  Timestamp,
  WhereFilterOp,
  enableNetwork,
  disableNetwork,
  waitForPendingWrites
} from 'firebase/firestore';
import { db } from './firebase';

export class DatabaseService {
  private static isOnline = true;
  private static retryAttempts = 3;
  private static retryDelay = 1000;

  static async enableNetwork() {
    try {
      await enableNetwork(db);
      this.isOnline = true;
      console.log('✅ Firestore network enabled');
    } catch (error) {
      console.error('❌ Failed to enable network:', error);
    }
  }

  static async disableNetwork() {
    try {
      await disableNetwork(db);
      this.isOnline = false;
      console.log('📴 Firestore network disabled');
    } catch (error) {
      console.error('❌ Failed to disable network:', error);
    }
  }

  static async waitForPendingWrites() {
    try {
      await waitForPendingWrites(db);
      console.log('✅ All pending writes completed');
    } catch (error) {
      console.error('❌ Error waiting for pending writes:', error);
    }
  }

  private static async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError;
    for (let i = 0; i < this.retryAttempts; i++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        console.warn(`Attempt ${i + 1}/${this.retryAttempts} failed:`, error.code || error.message);
        
        if (error.code === 'unavailable' || error.code === 'failed-precondition') {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (i + 1)));
        } else {
          throw error;
        }
      }
    }
    throw lastError;
  }
  static async create(collectionName: string, data: any, customId?: string) {
    return this.retryOperation(async () => {
      try {
        const cleanData = this.cleanUndefinedFields(data);
        const dataWithTimestamp = {
          ...cleanData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (customId) {
          await setDoc(doc(db, collectionName, customId), dataWithTimestamp);
          console.log(`✅ Document created: ${collectionName}/${customId}`);
          return customId;
        } else {
          const docRef = await addDoc(collection(db, collectionName), dataWithTimestamp);
          console.log(`✅ Document created: ${collectionName}/${docRef.id}`);
          return docRef.id;
        }
      } catch (error: any) {
        console.error('❌ Create document error:', error);
        this.handleFirestoreError(error);
        throw error;
      }
    });
  }

  private static cleanUndefinedFields(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    
    const cleaned: any = Array.isArray(obj) ? [] : {};
    
    for (const key in obj) {
      if (obj[key] !== undefined) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          cleaned[key] = this.cleanUndefinedFields(obj[key]);
        } else {
          cleaned[key] = obj[key];
        }
      }
    }
    
    return cleaned;
  }

  private static handleFirestoreError(error: any) {
    if (error.code === 'unavailable') {
      console.error('⚠️ Firestore is unavailable. Check your internet connection.');
    } else if (error.code === 'failed-precondition') {
      console.error('⚠️ Firestore query requires an index. Check console for index creation link.');
    } else if (error.code === 'permission-denied') {
      console.error('⚠️ Permission denied. Check Firestore security rules.');
    } else if (error.code === 'unauthenticated') {
      console.error('⚠️ User not authenticated.');
    }
  }

  static async get(collectionName: string, documentId: string) {
    return this.retryOperation(async () => {
      try {
        const docRef = doc(db, collectionName, documentId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
      } catch (error: any) {
        console.error('❌ Get document error:', error);
        this.handleFirestoreError(error);
        throw error;
      }
    });
  }

  static async getAll(collectionName: string) {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error: any) {
      console.error('Get all documents error:', error);
      throw new Error(error.message);
    }
  }

  static async query(
    collectionName: string, 
    conditions: { field: string; operator: WhereFilterOp; value: any }[],
    orderByField?: string,
    orderDirection: 'asc' | 'desc' = 'asc',
    limitCount?: number
  ) {
    return this.retryOperation(async () => {
      try {
        let q = query(collection(db, collectionName));

        conditions.forEach(condition => {
          q = query(q, where(condition.field, condition.operator, condition.value));
        });

        if (orderByField) {
          q = query(q, orderBy(orderByField, orderDirection));
        }

        if (limitCount) {
          q = query(q, limit(limitCount));
        }

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error: any) {
        console.error('❌ Query documents error:', error);
        this.handleFirestoreError(error);
        
        if (error.message && error.message.includes('index')) {
          const indexUrl = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
          if (indexUrl) {
            console.error('🔗 Create index here:', indexUrl[0]);
          }
        }
        
        throw error;
      }
    });
  }

  static async update(collectionName: string, documentId: string, data: any) {
    try {
      const docRef = doc(db, collectionName, documentId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (error: any) {
      console.error('Update document error:', error);
      throw new Error(error.message);
    }
  }

  static async delete(collectionName: string, documentId: string) {
    try {
      await deleteDoc(doc(db, collectionName, documentId));
    } catch (error: any) {
      console.error('Delete document error:', error);
      throw new Error(error.message);
    }
  }
}

export interface Ride {
  id?: string;
  userId: string;
  driverId?: string;
  pickupLocation: { lat: number; lng: number; address: string };
  dropoffLocation: { lat: number; lng: number; address: string };
  rideType: string;
  status: 'pending' | 'accepted' | 'in-progress' | 'completed' | 'cancelled';
  fare: number;
  distance: number;
  duration: number;
  scheduledTime?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Driver {
  id?: string;
  userId: string;
  vehicleType: string;
  vehicleModel: string;
  vehiclePlate: string;
  licenseNumber: string;
  rating: number;
  totalTrips: number;
  status: 'available' | 'busy' | 'offline';
  currentLocation?: { lat: number; lng: number };
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
