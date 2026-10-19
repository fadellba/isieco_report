import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showSubtitle?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'medium', showSubtitle = true }) => {
  const getDimensions = () => {
    switch (size) {
      case 'small':
        return {
          badgeSize: 36,
          iconSize: 18,
          titleSize: 16,
          subSize: 9,
          badgeRadius: 10,
        };
      case 'large':
        return {
          badgeSize: 84,
          iconSize: 42,
          titleSize: 28,
          subSize: 12,
          badgeRadius: 24,
        };
      default:
        return {
          badgeSize: 56,
          iconSize: 28,
          titleSize: 22,
          subSize: 11,
          badgeRadius: 16,
        };
    }
  };

  const dim = getDimensions();

  return (
    <View style={styles.container}>
      {/* Icon Badge */}
      <View
        style={[
          styles.badge,
          {
            width: dim.badgeSize,
            height: dim.badgeSize,
            borderRadius: dim.badgeRadius,
          },
        ]}
      >
        <Text style={{ fontSize: dim.iconSize }}>🌿</Text>
      </View>

      {/* Typography */}
      <View style={styles.textContainer}>
        <View style={styles.brandRow}>
          <Text style={[styles.titleISI, { fontSize: dim.titleSize }]}>ISI-Eco</Text>
          <Text style={[styles.titleReport, { fontSize: dim.titleSize }]}>Report</Text>
        </View>

        {showSubtitle && (
          <View style={styles.taglineBox}>
            <Text style={[styles.subtitle, { fontSize: dim.subSize }]}>
              DAKAR-PLATEAU & MÉDINA
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  badge: {
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    borderWidth: 2,
    borderColor: '#bbf7d0',
  },
  textContainer: {
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleISI: {
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  titleReport: {
    fontWeight: '900',
    color: '#16a34a',
    letterSpacing: -0.5,
    marginLeft: 4,
  },
  taglineBox: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginTop: 4,
  },
  subtitle: {
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.8,
  },
});

