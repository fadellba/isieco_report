import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import type { ColorSchemeName } from 'react-native';
import {
  DESIGN_TOKENS,
  type DesignTokens,
  type ResolvedTheme,
  type ThemePreference,
} from '@isieco/shared';

export const THEME_PREFERENCE_KEY = '@isieco_theme_preference_v1';

interface ThemeContextValue {
  preference: ThemePreference;
  theme: ResolvedTheme;
  colors: DesignTokens;
  loadingTheme: boolean;
  persistenceError: string | null;
  setPreference: (preference: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function resolveTheme(
  preference: ThemePreference,
  systemTheme: ColorSchemeName | null,
): ResolvedTheme {
  if (preference !== 'system') return preference;
  return systemTheme === 'dark' ? 'dark' : 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );
  const [loadingTheme, setLoadingTheme] = useState(true);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(THEME_PREFERENCE_KEY)
      .then((stored) => {
        if (!mounted || !stored) return;
        if (isThemePreference(stored)) {
          setPreferenceState(stored);
        } else {
          console.error('Saved theme preference has an unsupported value.');
          setPersistenceError('La préférence de thème enregistrée est invalide.');
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to load saved theme preference.', error);
        if (mounted) {
          setPersistenceError('La préférence de thème n’a pas pu être chargée.');
        }
      })
      .finally(() => {
        if (mounted) setLoadingTheme(false);
      });

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme === 'dark' ? 'dark' : 'light');
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const setPreference = useCallback(async (nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    setPersistenceError(null);
    try {
      await AsyncStorage.setItem(THEME_PREFERENCE_KEY, nextPreference);
    } catch (error) {
      console.error('Unable to save theme preference.', error);
      setPersistenceError('Le thème est appliqué, mais votre préférence n’a pas pu être enregistrée.');
    }
  }, []);

  const theme = resolveTheme(preference, systemTheme);
  const value = useMemo<ThemeContextValue>(() => ({
    preference,
    theme,
    colors: DESIGN_TOKENS[theme],
    loadingTheme,
    persistenceError,
    setPreference,
  }), [preference, theme, loadingTheme, persistenceError, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
