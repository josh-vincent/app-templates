import { Link, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import Header from '@/components/Header';
import Icon from '@/components/Icon';
import { useThemeColors } from '@/contexts/ThemeColors';
import { listChats, type StoredChat } from '@/lib/chatStorage';
import { BRICK, INK, PARCHMENT, PARCHMENT_DEEP, SERIF } from '@/lib/theme';

interface ChatRow {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}

function deriveLastMessage(chat: StoredChat): string {
  for (let i = chat.messages.length - 1; i >= 0; i--) {
    const m = chat.messages[i];
    const text = (m.parts ?? []).find((p: any) => p.type === 'text')?.text;
    if (text) return text;
  }
  return 'Tap to open the conversation.';
}

function toRow(chat: StoredChat, idx: number): ChatRow {
  const avatarId = 10 + (chat.id.length + idx) % 60;
  return {
    id: chat.id,
    name: chat.title || 'Untitled chat',
    avatar: `https://i.pravatar.cc/150?img=${avatarId}`,
    lastMessage: deriveLastMessage(chat),
    timestamp: relativeTime(chat.updatedAt || chat.createdAt),
    unread: Date.now() - (chat.updatedAt || chat.createdAt) < 6 * 60 * 60 * 1000,
  };
}

export default function ChatListScreen() {
  const themeColors = useThemeColors();
  const isDark = themeColors.isDark;
  const screenBg = isDark ? themeColors.bg : PARCHMENT;
  const textColor = isDark ? themeColors.text : INK;
  const unreadBg = isDark ? themeColors.secondary : PARCHMENT_DEEP;
  const readBg = isDark ? 'rgba(38,38,38,0.6)' : 'rgba(239,236,230,0.62)';
  const [rows, setRows] = useState<ChatRow[]>([]);

  const load = useCallback(async () => {
    const chats = await listChats();
    setRows(chats.map(toRow));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const renderChatItem = ({ item }: { item: ChatRow }) => (
    <Link href={`/screens/chat/${item.id}`} asChild>
      <Pressable
        className="flex-row items-center rounded-2xl p-4"
        style={{ backgroundColor: item.unread ? unreadBg : readBg }}>
        <Avatar size="md" src={item.avatar} name={item.name} />
        <View className="ml-3 flex-1">
          <View className="flex-row items-center">
            <Text style={{ color: textColor, fontFamily: SERIF, fontSize: 15, letterSpacing: -0.1 }}>
              {item.name}
            </Text>
            <Text className="ml-auto" style={{ color: textColor, fontSize: 11, opacity: 0.5 }}>
              {item.timestamp}
            </Text>
          </View>
          <View className="mt-1 flex-row items-center">
            <Text
              numberOfLines={1}
              className="flex-1 pr-3"
              style={{
                color: textColor,
                fontSize: 12,
                fontStyle: item.unread ? 'normal' : 'italic',
                opacity: item.unread ? 0.72 : 0.52,
              }}>
              {item.lastMessage}
            </Text>
            {item.unread ? (
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: BRICK }} />
            ) : (
              <Icon name="ChevronRight" size={14} color={textColor} />
            )}
          </View>
        </View>
      </Pressable>
    </Link>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: screenBg }}>
      <Header title="Messages" showBackButton />
      <FlatList
        data={rows}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, gap: 8, paddingBottom: 40 }}
        ListHeaderComponent={
          <View className="pb-4">
            <Text style={{ color: textColor, fontFamily: SERIF, fontSize: 30, letterSpacing: -0.3 }}>
              Messages
            </Text>
            <Text
              className="mt-1"
              style={{ color: textColor, fontSize: 13, fontStyle: 'italic', opacity: 0.6 }}>
              Travel threads and trip support in one place.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <Icon name="MessageSquare" size={32} color={textColor} />
            <Text style={{ color: textColor, fontFamily: SERIF, fontSize: 16, marginTop: 8 }}>
              No conversations yet
            </Text>
            <Text style={{ color: textColor, fontSize: 12, opacity: 0.6, marginTop: 4 }}>
              Start one from the Assistant tab.
            </Text>
          </View>
        }
      />
    </View>
  );
}
