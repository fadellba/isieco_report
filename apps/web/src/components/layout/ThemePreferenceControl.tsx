import React from 'react';
import type { ThemePreference } from '@isieco/shared';
import { useTheme } from '../../context/ThemeContext.js';

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

function isThemePreference(value: string): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

interface ThemePreferenceControlProps {
  compact?: boolean;
}

export const ThemePreferenceControl: React.FC<ThemePreferenceControlProps> = ({ compact = false }) => {
  const { preference, setPreference, persistenceError } = useTheme();

  return (
    <div className="theme-preference-control">
      {!compact && <label htmlFor="theme-preference">Apparence</label>}
      <select
        id={compact ? undefined : 'theme-preference'}
        aria-label="Thème de l’application"
        value={preference}
        onChange={(event) => {
          const value = event.target.value;
          if (isThemePreference(value)) setPreference(value);
        }}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {persistenceError && (
        <span className="theme-preference-control__error" role="status">
          {persistenceError}
        </span>
      )}
    </div>
  );
};
