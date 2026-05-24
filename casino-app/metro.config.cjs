const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (process.env.EXPO_PUBLIC_ENABLE_REACT_NATIVE_GRAB === 'true') {
  const { withReactNativeGrab } = require('react-native-grab/metro');
  module.exports = withReactNativeGrab(config);
} else {
  module.exports = config;
}
