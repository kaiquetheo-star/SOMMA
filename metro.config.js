const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Prefer CommonJS entry points when packages expose import.meta in ESM (e.g. zustand)
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

module.exports = withNativeWind(config, { input: './global.css' });
