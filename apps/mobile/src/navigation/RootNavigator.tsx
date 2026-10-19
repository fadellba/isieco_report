import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext.js';
import { useOnboarding } from '../context/OnboardingContext.js';
import { SplashScreen } from '../screens/common/SplashScreen.js';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen.js';
import { LoginScreen } from '../screens/auth/LoginScreen.js';
import { CitoyenNavigator } from './CitoyenNavigator.js';
import { TerrainNavigator } from './TerrainNavigator.js';

export const RootNavigator: React.FC = () => {
  const [isSplashFinished, setIsSplashFinished] = useState(false);
  const { user, token, loading, isTerrainAgent } = useAuth();
  const { hasCompletedOnboarding, loadingOnboarding } = useOnboarding();

  // 1. Splash Screen
  if (!isSplashFinished) {
    return <SplashScreen onFinish={() => setIsSplashFinished(true)} />;
  }

  // 2. Loading state after splash
  if (loading || loadingOnboarding) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  // 3. Onboarding flow for new users (or when replayed)
  if (!hasCompletedOnboarding) {
    return <OnboardingScreen />;
  }

  // 4. Authentication flow
  if (!token || !user) {
    return <LoginScreen />;
  }

  // 5. Role-based app flow
  if (isTerrainAgent) {
    return <TerrainNavigator />;
  }

  return <CitoyenNavigator />;
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});
