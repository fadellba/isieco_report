import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext.js';
import { useOffline } from '../../context/OfflineContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import { ThemePreferenceControl } from '../../components/ThemePreferenceControl.js';
import { useOnboarding } from '../../context/OnboardingContext.js';
import type { DesignTokens } from '@isieco/shared';

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    isOnline,
    setIsOnline,
    pendingCount,
    legacyPendingCount,
    queueError,
    syncNow,
    syncing,
  } = useOffline();
  const { resetOnboarding } = useOnboarding();
  const [confirmation, setConfirmation] = useState<'logout' | 'onboarding' | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleSync = async () => {
    setSyncFeedback(null);
    try {
      const result = await syncNow();
      if (result.failed > 0) {
        setSyncFeedback({
          type: 'error',
          message: `${result.synced} action(s) synchronisée(s), ${result.failed} action(s) restent en attente.`,
        });
      } else {
        setSyncFeedback({
          type: 'success',
          message: `${result.synced} action(s) synchronisée(s) avec succès.`,
        });
      }
    } catch (error) {
      setSyncFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Impossible de synchroniser les actions hors ligne.',
      });
    }
  };

  const handleLogout = async () => {
    setConfirmation(null);
    await logout();
  };

  const handleReplayOnboarding = () => {
    setConfirmation('onboarding');
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
      {/* User Info Card */}
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.prenom?.[0] || user?.nom?.[0] || 'U'}
          </Text>
        </View>
        <Text style={styles.name}>
          {user?.prenom} {user?.nom}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.rolesRow}>
          {user?.roles?.map((r) => (
            <View key={r} style={styles.roleBadge}>
              <Text style={styles.roleText}>{r}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, styles.themeCard]}>
        <ThemePreferenceControl />
      </View>

      {/* Network & Offline Simulation Card */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}>Connectivité & Résilience Dakar</Text>

        <View style={styles.switchRow}>
          <View style={styles.switchTextCol}>
            <Text style={styles.switchLabel}>Simulateur Réseau Mobile</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: isOnline ? colors.success : colors.danger,
                  marginRight: 6,
                }}
              />
              <Text style={styles.switchDesc}>
                {isOnline ? 'En ligne (4G/Wifi)' : 'Hors-ligne (Dakar Plateau/Médina)'}
              </Text>
            </View>
          </View>
          <Switch
            value={isOnline}
            onValueChange={setIsOnline}
            trackColor={{ false: colors.dangerSurface, true: colors.successSurface }}
            thumbColor={isOnline ? colors.success : colors.danger}
          />
        </View>

        <View style={styles.queueRow}>
          <Text style={styles.queueLabel}>File d'attente hors-ligne :</Text>
          <Text style={styles.queueVal}>{pendingCount} action(s)</Text>
        </View>

        {queueError && (
          <View accessibilityRole="alert" style={[styles.syncFeedback, styles.syncFeedbackError]}>
            <Text style={styles.syncFeedbackText}>{queueError}</Text>
          </View>
        )}
        {legacyPendingCount > 0 && (
          <View accessibilityRole="alert" style={[styles.syncFeedback, styles.syncFeedbackError]}>
            <Text style={styles.syncFeedbackText}>
              {legacyPendingCount} ancienne(s) action(s) sans compte propriétaire ont été conservées
              et ne seront pas synchronisées automatiquement. Veuillez les recréer après connexion.
            </Text>
          </View>
        )}

        {syncFeedback && (
          <View
            accessibilityRole={syncFeedback.type === 'error' ? 'alert' : 'status'}
            style={[
              styles.syncFeedback,
              syncFeedback.type === 'error' ? styles.syncFeedbackError : styles.syncFeedbackSuccess,
            ]}
          >
            <Text style={styles.syncFeedbackText}>{syncFeedback.message}</Text>
          </View>
        )}

        {pendingCount > 0 && isOnline && (
          <TouchableOpacity
            style={styles.syncBtn}
            onPress={() => void handleSync()}
            disabled={syncing}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="refresh-cw" size={14} color={colors.warning} style={{ marginRight: 6 }} />
              <Text style={styles.syncBtnText}>
                {syncing ? 'Synchronisation en cours...' : 'Vider & Synchroniser la file'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

      </View>

      {/* Replay Onboarding Guide */}
      <TouchableOpacity style={styles.onboardingBtn} onPress={handleReplayOnboarding}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="book-open" size={15} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.onboardingBtnText}>Revoir le Guide d'Accueil (Onboarding)</Text>
        </View>
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={() => setConfirmation('logout')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="log-out" size={15} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Se Déconnecter</Text>
        </View>
      </TouchableOpacity>

      </ScrollView>
      {confirmation && (
        <View style={styles.confirmationBackdrop} accessibilityViewIsModal>
          <View style={styles.confirmationCard} accessibilityRole="alert">
            <Text style={styles.confirmationTitle}>
              {confirmation === 'logout' ? 'Déconnexion' : 'Guide d’accueil'}
            </Text>
            <Text style={styles.confirmationMessage}>
              {confirmation === 'logout'
                ? 'Êtes-vous sûr de vouloir vous déconnecter ?'
                : 'Voulez-vous relancer le tutoriel de présentation de l’application ?'}
            </Text>
            <View style={styles.confirmationActions}>
              <TouchableOpacity
                style={styles.confirmationCancelBtn}
                onPress={() => setConfirmation(null)}
                accessibilityRole="button"
              >
                <Text style={styles.confirmationCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmationConfirmBtn}
                onPress={() => {
                  if (confirmation === 'logout') {
                    void handleLogout();
                  } else {
                    setConfirmation(null);
                    void resetOnboarding();
                  }
                }}
                accessibilityRole="button"
              >
                <Text style={styles.confirmationConfirmText}>
                  {confirmation === 'logout' ? 'Se déconnecter' : 'Relancer'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: DesignTokens) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  themeCard: {
    alignItems: 'stretch',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.primary,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  email: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    justifyContent: 'center',
  },
  roleBadge: {
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: colors.textSecondary,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 6,
  },
  switchTextCol: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  switchDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  queueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  queueLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  queueVal: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  syncFeedback: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
  },
  syncFeedbackError: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.danger,
  },
  syncFeedbackSuccess: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.success,
  },
  syncFeedbackText: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 17,
  },
  syncBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
  },
  syncBtnText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  onboardingBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  onboardingBtnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBtn: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  logoutText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmationBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmationCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  confirmationTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  confirmationMessage: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  confirmationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
  },
  confirmationCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmationCancelText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmationConfirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.danger,
  },
  confirmationConfirmText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
});
