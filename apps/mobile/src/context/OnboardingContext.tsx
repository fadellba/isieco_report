import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_KEY = '@isieco_onboarding_completed_v1';

interface OnboardingContextValue {
  hasCompletedOnboarding: boolean;
  loadingOnboarding: boolean;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [loadingOnboarding, setLoadingOnboarding] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((val) => {
        setHasCompletedOnboarding(val === 'true');
      })
      .catch(() => {
        setHasCompletedOnboarding(false);
      })
      .finally(() => {
        setLoadingOnboarding(false);
      });
  }, []);

  const completeOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setHasCompletedOnboarding(true);
  };

  const resetOnboarding = async () => {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
    setHasCompletedOnboarding(false);
  };

  return (
    <OnboardingContext.Provider
      value={{
        hasCompletedOnboarding,
        loadingOnboarding,
        completeOnboarding,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
};

