// What expo-asset 58 returns for a bundled image, depending on how the app was built.
//  - release build (APK/AAB): the image is an Android resource and both `uri` and `localUri` are
//    its resource NAME (confirmed on a phone: "Artwork URL: assets_trackicon").
//  - development (Expo Go / dev server): a real file:// address in the cache.
const mode = { release: true };

module.exports = {
  __mode: mode,
  Asset: {
    fromModule: () => ({
      downloadAsync: async () =>
        mode.release
          ? { uri: 'assets_trackicon', localUri: 'assets_trackicon' }
          : { uri: 'http://10.0.0.2:8081/assets/track-icon.png', localUri: 'file:///data/user/0/app/cache/ExponentAsset-abc.png' },
    }),
  },
};
