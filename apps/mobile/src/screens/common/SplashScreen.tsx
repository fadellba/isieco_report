import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Logo } from '../../components/Logo.js';
import { useTheme } from '../../context/ThemeContext.js';
import type { DesignTokens } from '@isieco/shared';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // Smooth Entry Animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto finish after 1.8 seconds
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      {/* Decorative Background Circles */}
      <View style={[styles.bgCircle, styles.circle1]} />
      <View style={[styles.bgCircle, styles.circle2]} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Logo size="large" showSubtitle={true} tone={theme === 'dark' ? 'dark' : 'light'} />

        <View style={styles.versionBox}>
          <Text style={styles.versionText}>Plateforme Municipale Participative v2.13</Text>
          <Text style={styles.subText}>Fastify REST • PostgreSQL 17 • Expo Mobile</Text>
        </View>

        <View style={styles.spinnerRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.spinnerText}>Initialisation du terminal nomade...</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const { width } = Dimensions.get('window');

const createStyles = (colors: DesignTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgCircle: {
    position: 'absolute',
    borderRadius: 500,
    backgroundColor: colors.primarySubtle,
  },
  circle1: {
    width: width * 1.2,
    height: width * 1.2,
    top: -width * 0.4,
    right: -width * 0.3,
  },
  circle2: {
    width: width * 0.8,
    height: width * 0.8,
    bottom: -width * 0.3,
    left: -width * 0.2,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  versionBox: {
    alignItems: 'center',
    marginTop: 36,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subText: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 40,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  spinnerText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
