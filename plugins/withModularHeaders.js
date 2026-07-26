const fs = require('fs');
const path = require('path');

const { withDangerousMod } = require('expo/config-plugins');

// Adds `use_modular_headers!` to the generated Podfile.
//
// GoogleSignIn 8.x (via @react-native-google-signin/google-signin) pulls in the
// Swift pod AppCheckCore, which depends on GoogleUtilities and RecaptchaInterop.
// Those two are Objective-C pods that don't define modules, so CocoaPods refuses
// to integrate them as static libraries and `pod install` fails outright with:
//
//   The following Swift pods cannot yet be integrated as static libraries
//
// Modular headers generate the module maps those targets need. The alternative,
// expo-build-properties' `ios.useFrameworks: "static"`, changes linkage for
// every pod in the project and has a much wider blast radius.
//
// This has to live in a plugin rather than in the Podfile itself: `ios/` is
// generated output (gitignored), so a hand edit there survives exactly until the
// next `expo prebuild` — and never reaches EAS, which always builds clean.
module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf8');

      if (contents.includes('use_modular_headers!')) return cfg;

      // Anchor to use_expo_modules! so we land inside the app target and keep
      // the surrounding indentation.
      const anchor = /^([ \t]*)use_expo_modules!/m;
      if (!anchor.test(contents)) {
        throw new Error(
          '[withModularHeaders] Could not find `use_expo_modules!` in the Podfile. ' +
            'The Expo template changed — update this plugin before building.',
        );
      }

      fs.writeFileSync(
        podfilePath,
        contents.replace(anchor, '$1use_modular_headers!\n$1use_expo_modules!'),
      );
      return cfg;
    },
  ]);
};
