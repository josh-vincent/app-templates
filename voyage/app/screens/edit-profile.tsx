import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Image, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Chip } from '@/components/Chip';
import Expandable from '@/components/Expandable';
import Header from '@/components/Header';
import Icon from '@/components/Icon';
import ThemedScroller from '@/components/ThemeScroller';
import Input from '@/components/forms/Input';
import Section from '@/components/layout/Section';
import { INK, PARCHMENT, PARCHMENT_DEEP, SERIF } from '@/lib/theme';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const onSave = () => {
    Alert.alert('Saved', 'Profile changes saved (mock).', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  return (
    <>
      <Header
        showBackButton
        rightComponents={[
          <Pressable
            onPress={onSave}
            accessibilityLabel="Save profile changes"
            accessibilityRole="button"
            className="rounded-full px-4 py-2.5"
            style={{ backgroundColor: INK }}>
            <Text style={{ color: PARCHMENT, fontFamily: SERIF, fontSize: 13 }}>Save changes</Text>
          </Pressable>,
        ]}
      />
      <ThemedScroller style={{ backgroundColor: PARCHMENT }}>
        <Section
          titleSize="3xl"
          className="pb-10 pt-4"
          title="Profile Settings"
          subtitle="Manage your account settings"
        />

        <View className="mb-8 mt-6 flex-col items-center">
          <TouchableOpacity onPress={pickImage} className="relative" activeOpacity={0.9}>
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                className="h-28 w-28 rounded-full border border-light-primary dark:border-dark-primary"
              />
            ) : (
              <View
                className="h-24 w-24 items-center justify-center rounded-full"
                style={{ backgroundColor: PARCHMENT_DEEP }}>
                <Icon name="Plus" size={25} color={INK} />
              </View>
            )}
          </TouchableOpacity>
          <View className="mt-4 items-center">
            <Pressable
              onPress={pickImage}
              className="rounded-full border px-5 py-3"
              style={{ borderColor: INK }}>
              <Text style={{ color: INK, fontFamily: SERIF, fontSize: 14 }}>
                {profileImage ? 'Change photo' : 'Upload photo'}
              </Text>
            </Pressable>

            {profileImage && (
              <Pressable className="mt-2 px-4 py-2" onPress={() => setProfileImage(null)}>
                <Text style={{ color: INK, fontSize: 13, opacity: 0.6 }}>Remove photo</Text>
              </Pressable>
            )}
          </View>
        </View>
        <Expandable
          icon="UserRoundPen"
          title="Personal information"
          description="Manage your personal information"
          variant="voyage">
          <View className="flex-col gap-2">
            <Input
              label="First Name"
              value="John"
              autoCapitalize="words"
            />
            <Input
              label="Last Name"
              value="Doe"
              autoCapitalize="words"
            />
          </View>
        </Expandable>
        <Expandable
          icon="Lightbulb"
          title="Interests"
          description="Personalize your experience"
          variant="voyage">
          <View className="flex-row flex-wrap gap-2">
            <Chip label="Beach" />
            <Chip label="Mountain" />
            <Chip label="City" />
            <Chip label="Countryside" />
            <Chip label="Lake" />
            <Chip label="Forest" />
            <Chip label="Desert" />
            <Chip label="Snow" />
            <Chip label="Arctic" />
            <Chip label="Tropical" />
            <Chip label="Tundra" />
            <Chip label="Volcanic" />
          </View>
        </Expandable>

        <Expandable
          icon="Mail"
          title="Email and phone"
          description="Manage your email"
          variant="voyage">
          <View className="flex-col gap-2">
            <Input
              label="Email"
              value="john.doe@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Phone"
              value="+1234567890"
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
          </View>
        </Expandable>

        <Expandable
          icon="LockIcon"
          title="Password"
          description="Manage your password"
          variant="voyage">
          <View className="flex-col gap-2">
            <Input
              label="Current password"
              value="********"
              isPassword
              autoCapitalize="none"
            />
            <Input
              label="New password"
              value="********"
              isPassword
              autoCapitalize="none"
            />
          </View>
        </Expandable>
      </ThemedScroller>
    </>
  );
}
