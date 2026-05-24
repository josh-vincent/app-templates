import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import Header from '@/components/Header';
import Input from '@/components/forms/Input';
import { BRICK, INK, MOSS, PARCHMENT, PARCHMENT_DEEP, SERIF } from '@/lib/theme';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [strengthText, setStrengthText] = useState('');

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

  const checkPasswordStrength = (value: string) => {
    let strength = 0;
    const feedback = [];

    if (value.length >= 8) {
      strength += 25;
    } else {
      feedback.push('At least 8 characters');
    }

    if (/[A-Z]/.test(value)) {
      strength += 25;
    } else {
      feedback.push('Add uppercase letter');
    }

    if (/[a-z]/.test(value)) {
      strength += 25;
    } else {
      feedback.push('Add lowercase letter');
    }

    if (/[0-9!@#$%^&*(),.?":{}|<>]/.test(value)) {
      strength += 25;
    } else {
      feedback.push('Add number or special character');
    }

    setPasswordStrength(strength);
    setStrengthText(feedback.join(' / ') || 'Strong password');
    return strength >= 75;
  };

  const validatePassword = (value: string) => {
    if (!value) {
      setPasswordError('Password is required');
      return false;
    }
    if (value.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return false;
    }
    if (!checkPasswordStrength(value)) {
      setPasswordError('Please create a stronger password');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const validateConfirmPassword = (value: string) => {
    if (!value) {
      setConfirmPasswordError('Confirm password is required');
      return false;
    }
    if (value !== password) {
      setConfirmPasswordError('Passwords do not match');
      return false;
    }
    setConfirmPasswordError('');
    return true;
  };

  const handleSignup = () => {
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    const isConfirmPasswordValid = validateConfirmPassword(confirmPassword);

    if (isEmailValid && isPasswordValid && isConfirmPasswordValid) {
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
            Create your account
          </Text>
          <Text
            className="mt-2"
            style={{ color: INK, fontSize: 13, fontStyle: 'italic', opacity: 0.6 }}>
            Save watched routes, trips, and your travel preferences.
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
                checkPasswordStrength(text);
                if (passwordError) validatePassword(text);
              }}
              error={passwordError}
              isPassword
              autoCapitalize="none"
              containerClassName="mb-4"
            />

            <Input
              label="Confirm password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (confirmPasswordError) validateConfirmPassword(text);
              }}
              error={confirmPasswordError}
              containerClassName="mb-4"
              isPassword
              autoCapitalize="none"
            />

            {password.length > 0 && (
              <View className="mb-4">
                <View
                  className="h-1 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: 'rgba(19,26,42,0.1)' }}>
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${passwordStrength}%`,
                      backgroundColor:
                        passwordStrength >= 75 ? MOSS : passwordStrength >= 50 ? BRICK : '#b84a3a',
                    }}
                  />
                </View>
                <Text className="mt-2" style={{ color: INK, fontSize: 12, opacity: 0.55 }}>
                  {strengthText}
                </Text>
              </View>
            )}

            <Pressable
              onPress={handleSignup}
              disabled={isLoading}
              className="mt-2 h-14 flex-row items-center justify-center rounded-2xl"
              style={{ backgroundColor: INK, opacity: isLoading ? 0.65 : 1 }}>
              {isLoading ? (
                <ActivityIndicator color={PARCHMENT} />
              ) : (
                <Text style={{ color: PARCHMENT, fontFamily: SERIF, fontSize: 15 }}>Sign up</Text>
              )}
            </Pressable>
          </View>

          <View className="mt-6 flex-row justify-center">
            <Text style={{ color: INK, fontSize: 13, opacity: 0.6 }}>
              Already have an account?{' '}
            </Text>
            <Link href="/screens/login" asChild>
              <Pressable>
                <Text style={{ color: INK, fontFamily: SERIF, fontSize: 13 }}>Log in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
