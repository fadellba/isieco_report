import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from './src/context/AuthContext.js';
import { OfflineProvider } from './src/context/OfflineContext.js';
import { OnboardingProvider } from './src/context/OnboardingContext.js';
import { RootNavigator } from './src/navigation/RootNavigator.js';

export default function App() {
  return (
    <SafeAreaProvider>
      <OnboardingProvider>
        <AuthProvider>
          <OfflineProvider>
            <NavigationContainer>
              <RootNavigator />
              <StatusBar style="dark" />
            </NavigationContainer>
          </OfflineProvider>
        </AuthProvider>
      </OnboardingProvider>
    </SafeAreaProvider>
  );
}
