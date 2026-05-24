import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import ActionSheet, { ActionSheetRef } from 'react-native-actions-sheet';
import { useThemeColors } from '@/contexts/ThemeColors';
import Header, { HeaderIcon } from '@/components/Header';
import Avatar from '@/components/Avatar';
import ThemedText from '@/components/ThemedText';
import ActionSheetThemed from '@/components/ActionSheetThemed';
import Icon from '@/components/Icon';
import PageLoader from '@/components/PageLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Message {
  id: string;
  text: string;
  timestamp: string;
  isSent: boolean;
}

// Mock conversation data
const mockMessages: Message[] = [
  { id: '1', text: 'Heads up — JFK → HND just dropped to USD 482.', timestamp: '9:30 AM', isSent: false },
  {
    id: '2',
    text: 'Nice. Is that a 7-day window or a 14-day?',
    timestamp: '9:31 AM',
    isSent: true,
  },
  {
    id: '3',
    text: '14-day right now. Departure 14–28 May, return open. Want me to pin a fare for 24 hours?',
    timestamp: '9:32 AM',
    isSent: false,
  },
  {
    id: '4',
    text: 'Yes please. Economy, one adult.',
    timestamp: '9:33 AM',
    isSent: true,
  },
  {
    id: '5',
    text: 'Pinned. I\'ll watch alternates via Seoul and Hong Kong in case the Tokyo direct slips.',
    timestamp: '9:34 AM',
    isSent: false,
  },
  {
    id: '6',
    text: 'Perfect. Also keep an eye on baggage — I usually want a checked bag.',
    timestamp: '9:35 AM',
    isSent: true,
  },
  {
    id: '7',
    text: 'Got it. I\'ll prefer fares with a checked bag included; will flag if the price gap is > USD 35.',
    timestamp: '9:36 AM',
    isSent: false,
  },
];

// Mock user data
const mockUser = {
  id: '1',
  name: 'Voyage Concierge',
  avatar: 'https://i.pravatar.cc/150?img=11',
};

export default function ChatDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(mockMessages);
  const actionSheetRef = useRef<ActionSheetRef>(null);
  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setIsLoading(false);
      // Scroll to bottom after loading
      setTimeout(scrollToBottom, 100);
    }, 1000);

    // Set up keyboard listeners
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Scroll to bottom when keyboard shows
        setTimeout(scrollToBottom, 100);
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        // Scroll to bottom when keyboard hides
        setTimeout(scrollToBottom, 100);
      }
    );

    return () => {
      clearTimeout(timer);
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [scrollToBottom]);

  // Effect to scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  if (isLoading) {
    return <PageLoader text="Loading chat..." />;
  }

  const handleSend = () => {
    if (message.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        text: message.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSent: true,
      };
      setMessages([...messages, newMessage]);
      setMessage('');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View className={`flex-row ${item.isSent ? 'justify-end' : 'justify-start'} mb-4 px-4`}>
      <View
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${item.isSent ? 'bg-highlight' : 'bg-light-secondary dark:bg-dark-secondary'}`}>
        <ThemedText className={item.isSent ? 'text-white' : ''}>{item.text}</ThemedText>
        <ThemedText
          className={`mt-1 text-xs ${item.isSent ? 'text-white/70' : 'text-light-subtext dark:text-dark-subtext'}`}>
          {item.timestamp}
        </ThemedText>
      </View>
    </View>
  );

  const rightComponents = [
    <HeaderIcon icon="MoreVertical" href="0" onPress={() => actionSheetRef.current?.show()} />,
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}>
      <View
        //style={{ paddingBottom: insets.bottom }}
        className="flex-1 bg-light-primary dark:bg-dark-primary">
        <Header
          title={mockUser.name}
          className="border-b border-light-secondary dark:border-dark-secondary"
          showBackButton
          rightComponents={rightComponents}
          leftComponent={
            <View className="mr-2">
              <Avatar
                size="sm"
                src={mockUser.avatar}
                name={mockUser.name}
                className="mr-1"
                link="0"
              />
            </View>
          }
        />

        <FlatList
          ref={flatListRef}
          //style={{ paddingBottom: insets.bottom + 200 }}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingTop: 20,
            justifyContent: 'flex-end',
          }}
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
        />

        <View
          style={{
            paddingBottom: insets.bottom,
            //bottom: Platform.OS === 'ios' ? keyboardHeight : 0
            //position: Platform.OS === 'ios' ? 'absolute' : 'relative'
          }}
          className="z-50 w-full  border-t  border-light-secondary  bg-light-primary p-2 pb-0 dark:border-dark-secondary dark:bg-dark-primary">
          <View className="flex-row items-end rounded-xl bg-light-secondary px-4 py-2 dark:bg-dark-secondary">
            <TextInput
              ref={inputRef}
              value={message}
              onChangeText={setMessage}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              multiline
              onFocus={() => {
                // Add a space when the input is focused
                if (!message) {
                  setMessage(' ');
                }
                // Ensure we scroll to bottom when keyboard appears
                setTimeout(scrollToBottom, 0);
              }}
              className="max-h-32 flex-1 text-black dark:text-white"
              style={{
                minHeight: 30,
                fontSize: 16,
                lineHeight: Platform.OS === 'android' ? 30 : 0,
                paddingTop: Platform.OS === 'android' ? 0 : 5,
                paddingBottom: Platform.OS === 'android' ? 0 : 0,
              }}
            />
            <TouchableOpacity onPress={handleSend} className="mb-1 ml-2" disabled={!message.trim()}>
              <Icon
                name="Send"
                size={24}
                className={message.trim() ? 'text-highlight' : 'opacity-50'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <ActionSheetThemed
          ref={actionSheetRef}
          gestureEnabled
          containerStyle={{
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}>
          <View className="p-4">
            <TouchableOpacity className="flex-row items-center py-4">
              <Icon name="User" size={20} className="mr-3" />
              <ThemedText>View Profile</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center py-4">
              <Icon name="Slash" size={20} className="mr-3" />
              <ThemedText>Block User</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center py-4">
              <Icon name="Flag" size={20} className="mr-3" />
              <ThemedText>Report User</ThemedText>
            </TouchableOpacity>
          </View>
        </ActionSheetThemed>
      </View>
    </KeyboardAvoidingView>
  );
}
