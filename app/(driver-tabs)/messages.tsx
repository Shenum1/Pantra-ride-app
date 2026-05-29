import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  MessageCircle,
  Phone,
  Search,
  Headphones,
  AlertCircle,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useThemeStore';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { MessagingService, Conversation } from '@/lib/messaging-service';
import { router } from 'expo-router';

export default function DriverMessages() {
  const { colors } = useTheme();
  const { driver } = useDriverAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (!driver) {
      setError('Driver not found');
      setLoading(false);
      return;
    }

    setLoading(true);
    
    MessagingService.getDriverConversations(driver.id)
      .then((convs) => {
        setConversations(convs);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading conversations:', err);
        setError('Failed to load conversations');
        setLoading(false);
      });

    const unsubscribe = MessagingService.subscribeToDriverConversations(driver.id, (convs) => {
      setConversations(convs);
    });

    return () => unsubscribe();
  }, [driver]);

  const filteredConversations = conversations.filter(conv =>
    conv.userName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const ConversationItem = ({ conversation }: { conversation: Conversation }) => (
    <TouchableOpacity 
      style={[styles.messageItem, { backgroundColor: colors.card }]}
      onPress={() => {
        router.push({
          pathname: '/driver-message',
          params: {
            conversationId: conversation.id,
            passengerName: conversation.userName,
            passengerPhone: conversation.userPhone,
          },
        });
      }}
    >
      <View style={styles.avatarContainer}>
        <View style={[
          styles.avatar,
          { backgroundColor: colors.primary }
        ]}>
          <Text style={[styles.avatarText, { color: colors.white }]}>
            {conversation.userName.split(' ').map(n => n[0]).join('')}
          </Text>
        </View>
      </View>
      
      <View style={styles.messageContent}>
        <View style={styles.messageHeader}>
          <Text style={[styles.messageName, { color: colors.text }]}>{conversation.userName}</Text>
          <Text style={[styles.messageTime, { color: colors.textSecondary }]}>
            {formatTime(conversation.lastMessageTime)}
          </Text>
        </View>
        <View style={styles.messagePreview}>
          <Text style={[
            styles.lastMessage,
            { color: colors.textSecondary },
            conversation.unreadCountDriver > 0 && { color: colors.text, fontWeight: '500' }
          ]} numberOfLines={1}>
            {conversation.lastMessage || 'No messages yet'}
          </Text>
          {conversation.unreadCountDriver > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.unreadCount, { color: colors.white }]}>
                {conversation.unreadCountDriver}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );



  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && conversations.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
        </View>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
        <View style={[styles.headerStats, { backgroundColor: colors.primaryLight }]}>
          <MessageCircle size={16} color={colors.primary} />
          <Text style={[styles.headerStatsText, { color: colors.primary }]}>
            {conversations.reduce((sum, conv) => sum + conv.unreadCountDriver, 0)} unread
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.card }]}>
          <Search size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search messages..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Messages List */}
      <ScrollView style={styles.messagesList} showsVerticalScrollIndicator={false}>
        {filteredConversations.map((conversation) => (
          <ConversationItem key={conversation.id} conversation={conversation} />
        ))}
        
        {filteredConversations.length === 0 && (
          <View style={styles.emptyState}>
            <MessageCircle size={48} color={colors.lightGray} />
            <Text style={[styles.emptyStateText, { color: colors.text }]}>No messages found</Text>
            <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
              {searchQuery ? 'Try a different search term' : 'Your conversations will appear here'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Support Button */}
      <TouchableOpacity style={[styles.supportButton, { backgroundColor: colors.primary }]}>
        <Headphones size={20} color={colors.white} />
        <Text style={[styles.supportButtonText, { color: colors.white }]}>Contact Support</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerStatsText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  messagesList: {
    flex: 1,
  },
  messageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageName: {
    fontSize: 16,
    fontWeight: '600',
  },
  messageTime: {
    fontSize: 12,
  },
  messagePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
  },
  unreadBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  unreadCount: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 100,
    paddingVertical: 16,
    borderRadius: 12,
  },
  supportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});