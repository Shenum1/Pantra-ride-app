import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useTheme } from '@/hooks/useThemeStore';
import { trpc } from '@/lib/trpc';

const CATEGORY_LABELS: Record<string, string> = {
  ride_issue: 'Ride',
  payment_issue: 'Payment',
  account_issue: 'Account',
  safety: 'Safety',
  other: 'Other',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

interface TicketMessage {
  id: string;
  senderType: 'user' | 'driver' | 'admin';
  text: string;
  createdAt: string;
}

export default function TicketDetailScreen() {
  const { colors } = useTheme();
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const [reply, setReply] = useState('');

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.support.getTicket.useQuery(
    { ticketId: ticketId ?? '' },
    { enabled: !!ticketId }
  );
  const replyMutation = trpc.support.reply.useMutation({
    onSuccess: () => {
      setReply('');
      void utils.support.getTicket.invalidate({ ticketId: ticketId ?? '' });
      void utils.support.listMyTickets.invalidate();
    },
  });

  const ticket = data?.ticket;
  const messages = (data?.messages ?? []) as TicketMessage[];
  const isClosed = ticket?.status === 'closed';

  const handleSend = () => {
    if (!reply.trim() || !ticketId) return;
    replyMutation.mutate({ ticketId, text: reply.trim() });
  };

  const renderMessage = ({ item }: { item: TicketMessage }) => {
    const isMine = item.senderType !== 'admin';
    return (
      <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowTheirs]}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isMine ? colors.primary : colors.card,
              borderColor: colors.border,
              borderWidth: isMine ? 0 : 1,
            },
          ]}
        >
          <Text style={[styles.bubbleSender, { color: isMine ? 'rgba(255,255,255,0.8)' : colors.textSecondary }]}>
            {isMine ? 'You' : 'Pantra Support'}
          </Text>
          <Text style={{ color: isMine ? '#fff' : colors.text, fontSize: 14, lineHeight: 20 }}>
            {item.text}
          </Text>
          <Text style={[styles.bubbleTime, { color: isMine ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading || !ticket) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']} />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.subject, { color: colors.text }]}>{ticket.subject}</Text>
          <Text style={[styles.summaryMeta, { color: colors.textSecondary }]}>
            {CATEGORY_LABELS[ticket.category] ?? ticket.category} · {STATUS_LABELS[ticket.status] ?? ticket.status}
          </Text>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
        />

        {isClosed ? (
          <View style={[styles.closedNotice, { backgroundColor: colors.lightGray }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
              This report is closed. Contact Support if you need to raise it again.
            </Text>
          </View>
        ) : (
          <View style={[styles.replyBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder="Write a reply..."
              placeholderTextColor={colors.textSecondary}
              style={[styles.replyInput, { color: colors.text, borderColor: colors.border }]}
              multiline
            />
            <Pressable
              style={[styles.sendButton, { backgroundColor: colors.primary, opacity: reply.trim() ? 1 : 0.5 }]}
              onPress={handleSend}
              disabled={!reply.trim() || replyMutation.isPending}
            >
              <Send size={18} color="#fff" />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summary: {
    padding: 16,
    borderBottomWidth: 1,
  },
  subject: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryMeta: {
    fontSize: 13,
  },
  messageList: {
    padding: 16,
    gap: 10,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 14,
    padding: 12,
  },
  bubbleSender: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  bubbleTime: {
    fontSize: 10,
    marginTop: 6,
  },
  closedNotice: {
    padding: 14,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
