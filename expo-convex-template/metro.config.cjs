const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Workspace integration: watch /packages for hot-reload from @jv/* sources.
config.watchFolders = [path.resolve(repoRoot, 'packages')];
config.resolver.disableHierarchicalLookup = false;
config.resolver.unstable_enableSymlinks = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(repoRoot, 'node_modules'),
];

if (process.env.EXPO_PUBLIC_ENABLE_REACT_NATIVE_GRAB === 'true') {
  const { withReactNativeGrab } = require('react-native-grab/metro');
  module.exports = withReactNativeGrab(config);
} else {
  module.exports = config;
}
