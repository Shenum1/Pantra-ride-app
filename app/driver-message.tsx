import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Send, ArrowLeft, Phone, AlertCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { MessagingService, Message } from '@/lib/messaging-service';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';

export default function DriverMessage() {
  const params = useLocalSearchParams();
  const { conversationId, passengerName, passengerPhone } = params;
  const { driver } = useDriverAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!conversationId || !driver) {
      setError('Conversation not found');
      setLoading(false);
      return;
    }

    const convId = conversationId as string;

    setLoading(true);
    
    MessagingService.getMessages(convId)
      .then((msgs) => {
        setMessages(msgs);
        setLoading(false);
        MessagingService.markMessagesAsRead(convId, driver.id, 'driver');
      })
      .catch((err) => {
        console.error('Error loading messages:', err);
        setError('Failed to load messages');
        setLoading(false);
      });

    const unsubscribe = MessagingService.subscribeToMessages(convId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      MessagingService.markMessagesAsRead(convId, driver.id, 'driver');
    });

    return () => unsubscribe();
  }, [conversationId, driver]);

  const sendMessage = async () => {
    if (inputText.trim() === '' || !driver || !conversationId) return;

    const messageText = inputText.trim();
    setInputText('');

    try {
      await MessagingService.sendMessage({
        conversationId: conversationId as string,
        senderId: driver.id,
        senderType: 'driver',
        text: messageText,
      });

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.error('Error sending message:', err);
      setInputText(messageText);
      setError('Failed to send message');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isDriver = item.senderType === 'driver';

    return (
      <View
        style={[
          styles.messageContainer,
          isDriver ? styles.driverMessage : styles.passengerMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isDriver ? styles.driverBubble : styles.passengerBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isDriver ? styles.driverText : styles.passengerText,
            ]}
          >
            {item.text}
          </Text>
          {item.createdAt && (
            <Text
              style={[
                styles.timestamp,
                isDriver ? styles.driverTimestamp : styles.passengerTimestamp,
              ]}
            >
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: (passengerName as string) || 'Message',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <ArrowLeft size={24} color={Colors.light.text} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </View>
    );
  }

  if (error && messages.length === 0) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: (passengerName as string) || 'Message',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <ArrowLeft size={24} color={Colors.light.text} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={Colors.light.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: (passengerName as string) || 'Message',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={Colors.light.text} />
            </TouchableOpacity>
          ),
          headerRight: () => passengerPhone ? (
            <TouchableOpacity
              style={styles.phoneButton}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  const phoneUrl = Platform.select({
                    ios: `tel:${passengerPhone}`,
                    android: `tel:${passengerPhone}`,
                  });
                  if (phoneUrl) {
                    import('react-native').then(({ Linking }) => {
                      Linking.openURL(phoneUrl);
                    });
                  }
                }
              }}
            >
              <Phone size={20} color={Colors.light.primary} />
            </TouchableOpacity>
          ) : undefined,
        }}
      />

      <View style={styles.content}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id || ''}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start a conversation with the passenger</Text>
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={Colors.light.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              inputText.trim() === '' && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={inputText.trim() === ''}
          >
            <Send size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  backButton: {
    padding: 8,
  },
  phoneButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
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
    color: Colors.light.text,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  driverMessage: {
    alignSelf: 'flex-end',
  },
  passengerMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
  },
  driverBubble: {
    backgroundColor: Colors.light.primary,
    borderBottomRightRadius: 4,
  },
  passengerBubble: {
    backgroundColor: Colors.light.lightGray,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  driverText: {
    color: '#fff',
  },
  passengerText: {
    color: Colors.light.text,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  driverTimestamp: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  passengerTimestamp: {
    color: Colors.light.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: Colors.light.white,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.light.lightGray,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: Colors.light.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.light.textSecondary,
    opacity: 0.5,
  },
});
