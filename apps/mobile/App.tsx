import React from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { DESIGN_TOKENS } from '@isieco/shared';
import { AuthProvider } from './src/context/AuthContext.js';
import { OfflineProvider } from './src/context/OfflineContext.js';
import { OnboardingProvider } from './src/context/OnboardingContext.js';
import { ThemeProvider, useTheme } from './src/context/ThemeContext.js';
import { RootNavigator } from './src/navigation/RootNavigator.js';

const ThemedApp: React.FC = () => {
  const { theme } = useTheme();
  const colors = DESIGN_TOKENS[theme];
  const navigationTheme = {
    ...(theme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.danger,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootNavigator />
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <OnboardingProvider>
          <AuthProvider>
            <OfflineProvider>
              <ThemedApp />
            </OfflineProvider>
          </AuthProvider>
        </OnboardingProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
