module.exports = function (api) {
  // Cache keyed on NODE_ENV rather than unconditionally: the production-only
  // console stripping below would otherwise be frozen in from whichever
  // environment compiled first.
  api.cache.using(() => process.env.NODE_ENV);

  const plugins = ['react-native-worklets/plugin'];

  // Strip console.log from release builds so stray debug output never reaches
  // the iOS unified log. warn/error survive for crash diagnostics.
  if (process.env.NODE_ENV === 'production') {
    plugins.push(['transform-remove-console', { exclude: ['error', 'warn'] }]);
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
