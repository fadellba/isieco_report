const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    (moduleName === 'merge-options' || moduleName === 'styleq/transform-localize-style')
  ) {
    return context.resolveRequest(context, require.resolve(moduleName), platform);
  }

  // Map TypeScript ESM .js specifiers to their .ts/.tsx source files.
  const resolvedModuleName =
    moduleName.startsWith('.') && moduleName.endsWith('.js')
      ? moduleName.slice(0, -3)
      : moduleName;

  return context.resolveRequest(context, resolvedModuleName, platform);
};

module.exports = config;
