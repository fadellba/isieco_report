const staticConfig = require('./app.json').expo;

module.exports = ({ config }) => {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.EAS_BUILD_PROFILE === 'production';
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || (isProduction ? undefined : staticConfig.extra.apiUrl);

  if (!apiUrl) {
    throw new Error('EXPO_PUBLIC_API_URL doit être défini pour un build mobile de production.');
  }

  let parsedApiUrl;
  try {
    parsedApiUrl = new URL(apiUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL doit être une URL valide.');
  }

  if (
    !['http:', 'https:'].includes(parsedApiUrl.protocol) ||
    parsedApiUrl.username ||
    parsedApiUrl.password ||
    parsedApiUrl.pathname !== '/' ||
    parsedApiUrl.search ||
    parsedApiUrl.hash ||
    (isProduction && parsedApiUrl.protocol !== 'https:')
  ) {
    throw new Error('EXPO_PUBLIC_API_URL doit être une URL HTTPS sans identifiants en production.');
  }

  const apiUrlWeb =
    process.env.EXPO_PUBLIC_API_URL_WEB ||
    (isProduction ? apiUrl : staticConfig.extra.apiUrlWeb);

  return {
    ...config,
    plugins: [...(config.plugins || []), 'expo-secure-store'],
    extra: {
      ...config.extra,
      apiUrl: parsedApiUrl.origin,
      apiUrlWeb,
      apiEnvironment: isProduction ? 'production' : 'development',
    },
  };
};
