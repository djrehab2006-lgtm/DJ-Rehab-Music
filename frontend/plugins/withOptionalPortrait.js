const { withAndroidManifest } = require('expo/config-plugins');

// The app is locked to portrait, so Android assumes a portrait screen is REQUIRED and Google Play
// hides the app from devices that don't report one. Declaring the feature as optional keeps the
// portrait lock without the install restriction.
const FEATURE = 'android.hardware.screen.portrait';

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const others = (manifest['uses-feature'] ?? []).filter((f) => f.$['android:name'] !== FEATURE);
    manifest['uses-feature'] = [
      ...others,
      { $: { 'android:name': FEATURE, 'android:required': 'false' } },
    ];
    return cfg;
  });
};
