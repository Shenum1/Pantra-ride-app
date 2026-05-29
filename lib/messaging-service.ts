import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Message {
  id?: string;
  conversationId: string;
  senderId: string;
  senderType: 'user' | 'driver';
  text: string;
  read: boolean;
  timestamp: Timestamp | null;
  createdAt?: Timestamp;
}

export interface Conversation {
  id?: string;
  userId: string;
  userName: string;
  userPhone?: string;
  driverId: string;
  driverName: string;
  driverPhone?: string;
  rideId?: string;
  lastMessage?: string;
  lastMessageTime?: Timestamp;
  unreadCountUser: number;
  unreadCountDriver: number;
  status: 'active' | 'archived';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export class MessagingService {
  static async createConversation(data: {
    userId: string;
    userName: string;
    userPhone?: string;
    driverId: string;
    driverName: string;
    driverPhone?: string;
    rideId?: string;
  }): Promise<string> {
    try {
      const conversationId = `${data.userId}_${data.driverId}_${data.rideId || Date.now()}`;
      
      const existingConv = await getDoc(doc(db, 'conversations', conversationId));
      if (existingConv.exists()) {
        return conversationId;
      }

      const conversationData: Conversation = {
        ...data,
        unreadCountUser: 0,
        unreadCountDriver: 0,
        status: 'active',
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
      };

      await setDoc(doc(db, 'conversations', conversationId), conversationData);
      return conversationId;
    } catch (error: any) {
      console.error('Create conversation error:', error);
      throw new Error(error.message);
    }
  }

  static async sendMessage(data: {
    conversationId: string;
    senderId: string;
    senderType: 'user' | 'driver';
    text: string;
  }): Promise<string> {
    try {
      const messageData: Omit<Message, 'id'> = {
        conversationId: data.conversationId,
        senderId: data.senderId,
        senderType: data.senderType,
        text: data.text,
        read: false,
        timestamp: serverTimestamp() as Timestamp,
        createdAt: serverTimestamp() as Timestamp,
      };

      const messageRef = await addDoc(collection(db, 'messages'), messageData);

      const unreadField = data.senderType === 'user' ? 'unreadCountDriver' : 'unreadCountUser';
      const convRef = doc(db, 'conversations', data.conversationId);
      await updateDoc(convRef, {
        lastMessage: data.text,
        lastMessageTime: serverTimestamp(),
        [unreadField]: (await getDoc(convRef)).data()?.[unreadField] + 1 || 1,
        updatedAt: serverTimestamp(),
      });

      return messageRef.id;
    } catch (error: any) {
      console.error('Send message error:', error);
      throw new Error(error.message);
    }
  }

  static async getMessages(conversationId: string): Promise<Message[]> {
    try {
      const q = query(
        collection(db, 'messages'),
        where('conversationId', '==', conversationId),
        orderBy('timestamp', 'asc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
    } catch (error: any) {
      console.error('Get messages error:', error);
      throw new Error(error.message);
    }
  }

  static subscribeToMessages(
    conversationId: string,
    callback: (messages: Message[]) => void
  ): () => void {
    try {
      const q = query(
        collection(db, 'messages'),
        where('conversationId', '==', conversationId),
        orderBy('timestamp', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
        callback(messages);
      });

      return unsubscribe;
    } catch (error: any) {
      console.error('Subscribe to messages error:', error);
      return () => {};
    }
  }

  static async markMessagesAsRead(
    conversationId: string,
    userId: string,
    userType: 'user' | 'driver'
  ): Promise<void> {
    try {
      const q = query(
        collection(db, 'messages'),
        where('conversationId', '==', conversationId),
        where('senderType', '!=', userType),
        where('read', '==', false)
      );

      const querySnapshot = await getDocs(q);
      const updatePromises = querySnapshot.docs.map(doc =>
        updateDoc(doc.ref, { read: true })
      );

      await Promise.all(updatePromises);

      const unreadField = userType === 'user' ? 'unreadCountUser' : 'unreadCountDriver';
      const convRef = doc(db, 'conversations', conversationId);
      await updateDoc(convRef, {
        [unreadField]: 0,
      });
    } catch (error: any) {
      console.error('Mark messages as read error:', error);
      throw new Error(error.message);
    }
  }

  static async getUserConversations(userId: string): Promise<Conversation[]> {
    try {
      const q = query(
        collection(db, 'conversations'),
        where('userId', '==', userId),
        where('status', '==', 'active'),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
    } catch (error: any) {
      console.error('Get user conversations error:', error);
      throw new Error(error.message);
    }
  }

  static subscribeToUserConversations(
    userId: string,
    callback: (conversations: Conversation[]) => void
  ): () => void {
    try {
      const q = query(
        collection(db, 'conversations'),
        where('userId', '==', userId),
        where('status', '==', 'active'),
        orderBy('updatedAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
        callback(conversations);
      });

      return unsubscribe;
    } catch (error: any) {
      console.error('Subscribe to user conversations error:', error);
      return () => {};
    }
  }

  static async getDriverConversations(driverId: string): Promise<Conversation[]> {
    try {
      const q = query(
        collection(db, 'conversations'),
        where('driverId', '==', driverId),
        where('status', '==', 'active'),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
    } catch (error: any) {
      console.error('Get driver conversations error:', error);
      throw new Error(error.message);
    }
  }

  static subscribeToDriverConversations(
    driverId: string,
    callback: (conversations: Conversation[]) => void
  ): () => void {
    try {
      const q = query(
        collection(db, 'conversations'),
        where('driverId', '==', driverId),
        where('status', '==', 'active'),
        orderBy('updatedAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
        callback(conversations);
      });

      return unsubscribe;
    } catch (error: any) {
      console.error('Subscribe to driver conversations error:', error);
      return () => {};
    }
  }

  static async getConversation(conversationId: string): Promise<Conversation | null> {
    try {
      const docRef = doc(db, 'conversations', conversationId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Conversation;
      }
      return null;
    } catch (error: any) {
      console.error('Get conversation error:', error);
      throw new Error(error.message);
    }
  }
}
