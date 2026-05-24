// App-root error boundary. Catches any uncaught render error in the tree
// below and shows a recoverable card instead of a white screen of death.
//
// Kept minimal — production telemetry hookup goes through console.error
// for now; swap to Sentry/Bugsnag later.

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { EMBER, GOLD, IRON } from '@jv/tokens';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: IRON,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
        <View
          style={{
            backgroundColor: '#1a1f27',
            padding: 22,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: '#2a313d',
            maxWidth: 380,
          }}>
          <Text
            style={{
              color: EMBER,
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 1.4,
            }}>
            SOMETHING WENT SIDEWAYS
          </Text>
          <Text
            style={{
              color: 'white',
              fontSize: 18,
              fontWeight: '800',
              marginTop: 8,
              lineHeight: 24,
            }}>
            We caught the error before it crashed the app.
          </Text>
          <Text
            numberOfLines={4}
            style={{
              color: 'white',
              opacity: 0.6,
              fontSize: 12,
              marginTop: 10,
              fontFamily: 'Menlo',
            }}>
            {this.state.error.message}
          </Text>
          <Pressable
            onPress={this.reset}
            style={{
              marginTop: 18,
              height: 48,
              borderRadius: 14,
              backgroundColor: GOLD,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ color: IRON, fontWeight: '900', fontSize: 14 }}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}
