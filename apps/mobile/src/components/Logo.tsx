import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showSubtitle?: boolean;
  tone?: 'light' | 'dark';
}

export const Logo: React.FC<LogoProps> = ({
  size = 'medium',
  showSubtitle = true,
  tone = 'light',
}) => {
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
        <View style={[styles.cube, { width: dim.iconSize + 8, height: dim.iconSize + 8 }]}>
          <View style={[styles.cubeLayer, styles.cubeLayerBack, { width: dim.iconSize * 0.55, height: dim.iconSize * 0.55 }]} />
          <View style={[styles.cubeLayer, styles.cubeLayerMiddle, { width: dim.iconSize * 0.55, height: dim.iconSize * 0.55 }]} />
          <View style={[styles.cubeLayer, styles.cubeLayerFront, { width: dim.iconSize * 0.55, height: dim.iconSize * 0.55 }]} />
        </View>
      </View>

      <View style={styles.textContainer}>
        <View style={styles.brandRow}>
          <Text style={[styles.titleISI, tone === 'dark' && styles.titleISIDark, { fontSize: dim.titleSize }]}>ISI-Eco</Text>
          <Text style={[styles.titleReport, tone === 'dark' && styles.titleReportDark, { fontSize: dim.titleSize }]}>Report</Text>
        </View>

        {showSubtitle && (
          <View style={[styles.taglineBox, tone === 'dark' && styles.taglineBoxDark]}>
            <Text style={[styles.subtitle, tone === 'dark' && styles.subtitleDark, { fontSize: dim.subSize }]}>
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
    backgroundColor: '#103d27',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#36c883',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    borderWidth: 2,
    borderColor: '#48c58b',
  },
  cube: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cubeLayer: {
    position: 'absolute',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  cubeLayerBack: {
    backgroundColor: '#96e9b5',
    transform: [{ rotate: '45deg' }, { translateY: -5 }],
  },
  cubeLayerMiddle: {
    backgroundColor: '#48c58b',
    transform: [{ rotate: '45deg' }],
  },
  cubeLayerFront: {
    backgroundColor: '#16784e',
    transform: [{ rotate: '45deg' }, { translateY: 5 }],
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
  titleISIDark: {
    color: '#e5eee8',
  },
  titleReport: {
    fontWeight: '900',
    color: '#2b9c67',
    letterSpacing: -0.5,
    marginLeft: 4,
  },
  titleReportDark: {
    color: '#48c58b',
  },
  taglineBox: {
    backgroundColor: '#e8f5ec',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#b9e2c6',
    marginTop: 4,
  },
  taglineBoxDark: {
    backgroundColor: '#14251a',
    borderColor: '#294b37',
  },
  subtitle: {
    fontWeight: '800',
    color: '#17653f',
    letterSpacing: 0.8,
  },
  subtitleDark: {
    color: '#9eddb5',
  },
});
