const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Workspace integration: watch the monorepo's /packages for hot-reload from
// @jv/* sources, while still resolving the app's own node_modules first.
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

module.exports = config;
