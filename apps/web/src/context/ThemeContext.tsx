import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DESIGN_TOKENS,
  type DesignTokens,
  type ResolvedTheme,
  type ThemePreference,
} from '@isieco/shared';

const THEME_PREFERENCE_KEY = 'isieco_theme_preference_v1';

interface ThemeContextValue {
  preference: ThemePreference;
  theme: ResolvedTheme;
  colors: DesignTokens;
  persistenceError: string | null;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  useEffect(() => {
    let stored: string | null;
    try {
      stored = window.localStorage.getItem(THEME_PREFERENCE_KEY);
    } catch (error) {
      console.error('Unable to load saved theme preference.', error);
      setPersistenceError('La préférence de thème n’a pas pu être chargée.');
      stored = null;
    }

    if (stored && isThemePreference(stored)) {
      setPreferenceState(stored);
    } else if (stored) {
      console.error('Saved theme preference has an unsupported value.');
      setPersistenceError('La préférence de thème enregistrée est invalide.');
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', updateSystemTheme);
    return () => media.removeEventListener('change', updateSystemTheme);
  }, []);

  const theme = preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    const tokens = DESIGN_TOKENS[theme];
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    root.style.setProperty('--color-background', tokens.background);
    root.style.setProperty('--color-surface', tokens.surface);
    root.style.setProperty('--color-surface-raised', tokens.surfaceRaised);
    root.style.setProperty('--color-text-primary', tokens.textPrimary);
    root.style.setProperty('--color-text-secondary', tokens.textSecondary);
    root.style.setProperty('--color-border', tokens.border);
    root.style.setProperty('--color-primary', tokens.primary);
    root.style.setProperty('--color-on-primary', tokens.onPrimary);
    root.style.setProperty('--color-primary-subtle', tokens.primarySubtle);
    root.style.setProperty('--color-success', tokens.success);
    root.style.setProperty('--color-success-surface', tokens.successSurface);
    root.style.setProperty('--color-warning', tokens.warning);
    root.style.setProperty('--color-warning-surface', tokens.warningSurface);
    root.style.setProperty('--color-danger', tokens.danger);
    root.style.setProperty('--color-danger-surface', tokens.dangerSurface);
    root.style.setProperty('--color-info', tokens.info);
    root.style.setProperty('--color-info-surface', tokens.infoSurface);
  }, [theme]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    setPersistenceError(null);
    try {
      window.localStorage.setItem(THEME_PREFERENCE_KEY, nextPreference);
    } catch (error) {
      console.error('Unable to save theme preference.', error);
      setPersistenceError('Le thème est appliqué, mais votre préférence n’a pas pu être enregistrée.');
    }
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    preference,
    theme,
    colors: DESIGN_TOKENS[theme],
    persistenceError,
    setPreference,
  }), [preference, theme, persistenceError, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
