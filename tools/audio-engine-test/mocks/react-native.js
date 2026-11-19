module.exports = {
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
  Platform: {
    OS: 'android',
    Version: 36,
    constants: { Release: '16', Manufacturer: 'samsung', Model: 'SM-S156V' },
    select: (options) => options.android ?? options.default,
  },
  PermissionsAndroid: { PERMISSIONS: { POST_NOTIFICATIONS: 'POST_NOTIFICATIONS' }, check: async () => true },
  Alert: { alert() {} },
  Linking: { openSettings() {} },
};
