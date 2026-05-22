module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          jsxImportSource: 'nativewind',
          // Zustand persist (ESM) uses import.meta — required for web + Hermes
          unstable_transformImportMeta: true,
        },
      ],
      'nativewind/babel',
    ],
  };
};
