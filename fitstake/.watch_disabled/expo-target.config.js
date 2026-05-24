/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch',
  name: 'FitStakeWatch',
  displayName: 'FitStake',
  deploymentTarget: '10.0',
  bundleIdentifier: '.watchkitapp',
  frameworks: ['SwiftUI', 'WidgetKit'],
  colors: {
    $accent: '#22c55e',
    cardBg: '#0d1014',
    cardFg: '#ffffff',
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
