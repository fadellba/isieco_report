import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logo } from '../../components/Logo.js';
import { useOnboarding } from '../../context/OnboardingContext.js';

interface Slide {
  id: string;
  badge: string;
  icon: string;
  title: string;
  subtitle: string;
  highlight: string;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    badge: 'TERRITOIRE DAKAR',
    icon: '🏙️',
    title: 'Pour un Dakar Propre & Sain',
    subtitle:
      'Participez activement à la salubrité urbaine de Dakar-Plateau et de la Médina. Une action citoyenne collective pour préserver notre cadre de vie.',
    highlight: 'Dakar-Plateau • Médina • Marché Sandaga',
  },
  {
    id: '2',
    badge: 'GÉOLOCALISATION & PHOTO',
    icon: '📍',
    title: 'Signalez les Dépôts en 1-Clic',
    subtitle:
      'Capturez la position GPS automatique, prenez une photo du tas de déchets et sélectionnez les catégories constatées (plastique, gravats, encombrants).',
    highlight: 'Fonctionne même hors-ligne avec synchronisation automatique',
  },
  {
    id: '3',
    badge: 'GAMIFICATION CITOYENNE',
    icon: '🏆',
    title: 'Gagnez des Points Éco-Citoyens',
    subtitle:
      'Chaque constat vérifié crédite votre profil de points. Grimpez les échelons, de Citoyen Vigile jusqu au rang prestigieux de Champion de Salubrité !',
    highlight: '+10 pts par qualification • +20 pts par clôture validée',
  },
  {
    id: '4',
    badge: 'TRAÇABILITÉ MUNICIPALE',
    icon: '🚛',
    title: 'Équipes Municipales Déployées',
    subtitle:
      'Les équipes techniques communales sont dépêchées sur les lieux. Chaque intervention est certifiée par un compte-rendu terrain et une vérification 100%.',
    highlight: 'Invariant strict : 100% de résolution exigé avant clôture',
  },
];

export const OnboardingScreen: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { completeOnboarding } = useOnboarding();

  const handleNext = async () => {
    if (currentIndex < SLIDES.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      await handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleFinish = async () => {
    await completeOnboarding();
    if (onComplete) onComplete();
  };

  const current = SLIDES[currentIndex];
  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header: Logo & Skip button */}
      <View style={styles.topBar}>
        <Logo size="small" showSubtitle={false} />
        <TouchableOpacity style={styles.skipBtn} onPress={handleFinish}>
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>
      </View>

      {/* Main Slide Card */}
      <View style={styles.slideCard}>
        {/* Badge */}
        <View style={styles.badgePill}>
          <Text style={styles.badgeText}>{current.badge}</Text>
        </View>

        {/* Big Illustration Emoji Circle */}
        <View style={styles.illustrationCircle}>
          <Text style={styles.illustrationText}>{current.icon}</Text>
        </View>

        {/* Titles */}
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.subtitle}>{current.subtitle}</Text>

        {/* Feature Highlight Pill */}
        <View style={styles.highlightBox}>
          <Text style={styles.highlightText}>✨ {current.highlight}</Text>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomBar}>
        {/* Pagination Dots */}
        <View style={styles.paginationDots}>
          {SLIDES.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                currentIndex === idx && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Actions Row */}
        <View style={styles.actionsRow}>
          {currentIndex > 0 ? (
            <TouchableOpacity style={styles.prevBtn} onPress={handlePrev}>
              <Text style={styles.prevBtnText}>Précédent</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <TouchableOpacity
            style={[styles.nextBtn, isLast && styles.finishBtn]}
            onPress={handleNext}
          >
            <Text style={styles.nextBtnText}>
              {isLast ? 'Commencer l aventure 🚀' : 'Suivant →'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  skipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  slideCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  badgePill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.8,
  },
  illustrationCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    borderWidth: 4,
    borderColor: '#dcfce7',
    shadowColor: '#16a34a',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 3,
  },
  illustrationText: {
    fontSize: 62,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  highlightBox: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  highlightText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#16a34a',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  prevBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  prevBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  nextBtn: {
    flex: 2,
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#16a34a',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  finishBtn: {
    backgroundColor: '#0f172a',
    shadowColor: '#0f172a',
  },
  nextBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
