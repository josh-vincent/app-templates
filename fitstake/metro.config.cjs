const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Workspace integration: watch /packages for hot-reload from @jv/* sources.
config.projectRoot = projectRoot;
config.watchFolders = [path.resolve(repoRoot, 'packages')];
config.resolver = {
  ...config.resolver,
  disableHierarchicalLookup: false,
  unstable_enableSymlinks: true,
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(repoRoot, 'node_modules'),
  ],
};

if (process.env.EXPO_PUBLIC_ENABLE_REACT_NATIVE_GRAB === 'true') {
  const { withReactNativeGrab } = require('react-native-grab/metro');
  module.exports = withReactNativeGrab(config);
} else {
  module.exports = config;
}
