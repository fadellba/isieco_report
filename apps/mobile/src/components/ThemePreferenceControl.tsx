import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ThemePreference } from '@isieco/shared';
import { useTheme } from '../context/ThemeContext.js';

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

export const ThemePreferenceControl: React.FC = () => {
  const { preference, colors, persistenceError, setPreference } = useTheme();

  return (
    <View>
      <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
        Apparence
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3, marginBottom: 10 }}>
        Choisissez le thème de l’application.
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Thème de l’application"
        style={{
          alignSelf: 'stretch',
          flexDirection: 'row',
          padding: 4,
          gap: 4,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        {OPTIONS.map((option) => {
          const selected = preference === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`Thème ${option.label.toLowerCase()}`}
              onPress={() => void setPreference(option.value)}
              style={{
                flex: 1,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 9,
                backgroundColor: selected ? colors.primary : 'transparent',
              }}
            >
              <Text
                style={{
                  color: selected ? colors.onPrimary : colors.textSecondary,
                  fontSize: 12,
                  fontWeight: selected ? '700' : '500',
                }}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {persistenceError && (
        <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, marginTop: 8 }}>
          {persistenceError}
        </Text>
      )}
    </View>
  );
};
