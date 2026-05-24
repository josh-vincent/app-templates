import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import Header from '@/components/Header';
import Input from '@/components/forms/Input';
import { INK, PARCHMENT, PARCHMENT_DEEP, SERIF } from '@/lib/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) {
      setEmailError('Email is required');
      return false;
    }
    if (!emailRegex.test(value)) {
      setEmailError('Please enter a valid email');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (value: string) => {
    if (!value) {
      setPasswordError('Password is required');
      return false;
    }
    if (value.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleLogin = () => {
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (isEmailValid && isPasswordValid) {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        router.replace('/(tabs)/(home)');
      }, 1500);
    }
  };

  return (
    <>
      <Header showBackButton />
      <ScrollView
        className="flex-1"
        style={{ backgroundColor: PARCHMENT }}
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}>
        <View className="mt-4">
          <Text style={{ color: INK, fontFamily: SERIF, fontSize: 34, letterSpacing: -0.4 }}>
            Welcome back
          </Text>
          <Text
            className="mt-2"
            style={{ color: INK, fontSize: 13, fontStyle: 'italic', opacity: 0.6 }}>
            Sign in to keep watching fares and trips.
          </Text>

          <View className="mt-8 rounded-3xl p-4" style={{ backgroundColor: PARCHMENT_DEEP }}>
            <Input
              label="Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) validateEmail(text);
              }}
              error={emailError}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              containerClassName="mb-4"
            />

            <Input
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) validatePassword(text);
              }}
              error={passwordError}
              isPassword
              autoCapitalize="none"
              containerClassName="mb-4"
            />

            <Link href="/screens/forgot-password" asChild>
              <Pressable className="mb-5">
                <Text style={{ color: INK, fontFamily: SERIF, fontSize: 13 }}>
                  Forgot password?
                </Text>
              </Pressable>
            </Link>

            <Pressable
              onPress={handleLogin}
              disabled={isLoading}
              className="h-14 flex-row items-center justify-center rounded-2xl"
              style={{ backgroundColor: INK, opacity: isLoading ? 0.65 : 1 }}>
              {isLoading ? (
                <ActivityIndicator color={PARCHMENT} />
              ) : (
                <Text style={{ color: PARCHMENT, fontFamily: SERIF, fontSize: 15 }}>Login</Text>
              )}
            </Pressable>
          </View>

          <View className="mt-6 flex-row justify-center">
            <Text style={{ color: INK, fontSize: 13, opacity: 0.6 }}>Don't have an account? </Text>
            <Link href="/screens/signup" asChild>
              <Pressable>
                <Text style={{ color: INK, fontFamily: SERIF, fontSize: 13 }}>Sign up</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
