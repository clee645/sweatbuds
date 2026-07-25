/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'SweatbudsWidget',
  bundleIdentifier: 'com.sweatbuds.app.widget',
  deploymentTarget: '17.0',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.sweatbuds.app'],
  },
  frameworks: ['SwiftUI', 'WidgetKit'],
};
