/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'FitStakeWidgets',
  displayName: 'FitStake',
  deploymentTarget: '17.0',
  bundleIdentifier: '.widgets',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
  colors: {
    $accent: '#22c55e',
    $widgetBackground: '#0d1014',
    cardBg: { light: '#0d1014', dark: '#0d1014' },
    cardFg: { light: '#ffffff', dark: '#ffffff' },
    progressFg: '#22c55e',
    progressBg: '#1e2937',
    accentAmber: '#f59e0b',
  },
  entitlements: {
    'com.apple.security.application-groups': [
      'group.com.tocld.fitstake',
    ],
  },
});
