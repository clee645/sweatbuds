/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'notification-service',
  name: 'SweatbudsNotificationService',
  bundleIdentifier: 'com.sweatbuds.app.notifications',
  deploymentTarget: '17.0',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.sweatbuds.app'],
  },
  frameworks: ['UserNotifications', 'WidgetKit'],
};
