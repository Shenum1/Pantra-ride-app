import { supabase } from './supabase';

export interface Message {
  id?: string;
  conversationId: string;
  senderId: string;
  senderType: 'user' | 'driver';
  text: string;
  read: boolean;
  createdAt?: string;
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
  lastMessageTime?: string;
  unreadCountUser: number;
  unreadCountDriver: number;
  status: 'active' | 'archived';
  createdAt?: string;
  updatedAt?: string;
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
    const conversationId = `${data.userId}_${data.driverId}_${data.rideId || Date.now()}`;

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .single();

    if (existing) return conversationId;

    const { error } = await supabase.from('conversations').insert({
      id: conversationId,
      ...data,
      unreadCountUser: 0,
      unreadCountDriver: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);
    return conversationId;
  }

  static async sendMessage(data: {
    conversationId: string;
    senderId: string;
    senderType: 'user' | 'driver';
    text: string;
  }): Promise<string> {
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversationId: data.conversationId,
        senderId: data.senderId,
        senderType: data.senderType,
        text: data.text,
        read: false,
        createdAt: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    const unreadField = data.senderType === 'user' ? 'unreadCountDriver' : 'unreadCountUser';
    const { data: conv } = await supabase.from('conversations').select(unreadField).eq('id', data.conversationId).single();
    await supabase.from('conversations').update({
      lastMessage: data.text,
      lastMessageTime: new Date().toISOString(),
      [unreadField]: ((conv as any)?.[unreadField] ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    }).eq('id', data.conversationId);

    return message?.id ?? '';
  }

  static async getMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversationId', conversationId)
      .order('createdAt', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as Message[];
  }

  static subscribeToMessages(conversationId: string, callback: (messages: Message[]) => void): () => void {
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversationId=eq.${conversationId}` },
        async () => callback(await this.getMessages(conversationId))
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  static async markMessagesAsRead(conversationId: string, _userId: string, userType: 'user' | 'driver'): Promise<void> {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversationId', conversationId)
      .neq('senderType', userType)
      .eq('read', false);

    const unreadField = userType === 'user' ? 'unreadCountUser' : 'unreadCountDriver';
    await supabase.from('conversations').update({ [unreadField]: 0 }).eq('id', conversationId);
  }

  static async getUserConversations(userId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('userId', userId)
      .eq('status', 'active')
      .order('updatedAt', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as Conversation[];
  }

  static subscribeToUserConversations(userId: string, callback: (conversations: Conversation[]) => void): () => void {
    const channel = supabase
      .channel(`user-convs-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `userId=eq.${userId}` },
        async () => callback(await this.getUserConversations(userId))
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  static async getDriverConversations(driverId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('driverId', driverId)
      .eq('status', 'active')
      .order('updatedAt', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as Conversation[];
  }

  static subscribeToDriverConversations(driverId: string, callback: (conversations: Conversation[]) => void): () => void {
    const channel = supabase
      .channel(`driver-convs-${driverId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `driverId=eq.${driverId}` },
        async () => callback(await this.getDriverConversations(driverId))
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  static async getConversation(conversationId: string): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error || !data) return null;
    return data as Conversation;
  }
}
