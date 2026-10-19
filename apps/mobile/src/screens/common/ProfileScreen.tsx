import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext.js';
import { useOffline } from '../../context/OfflineContext.js';

import { useOnboarding } from '../../context/OnboardingContext.js';

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { isOnline, setIsOnline, pendingCount, syncNow, syncing } = useOffline();
  const { resetOnboarding } = useOnboarding();

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Êtes-vous sûr de vouloir vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleReplayOnboarding = () => {
    Alert.alert(
      'Guide d accueil',
      'Voulez-vous relancer le tutoriel de présentation de l application ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Relancer', onPress: () => resetOnboarding() },
      ]
    );
  };

  return (
    <View style={styles.container}>
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

      {/* Network & Offline Simulation Card */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}>Connectivité & Résilience Dakar</Text>

        <View style={styles.switchRow}>
          <View style={styles.switchTextCol}>
            <Text style={styles.switchLabel}>Simulateur Réseau Mobile</Text>
            <Text style={styles.switchDesc}>
              {isOnline ? '🟢 En ligne (4G/Wifi)' : '🔴 Hors-ligne (Dakar Plateau/Médina)'}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={setIsOnline}
            trackColor={{ false: '#fca5a5', true: '#86efac' }}
            thumbColor={isOnline ? '#16a34a' : '#dc2626'}
          />
        </View>

        <View style={styles.queueRow}>
          <Text style={styles.queueLabel}>File d'attente hors-ligne :</Text>
          <Text style={styles.queueVal}>{pendingCount} action(s)</Text>
        </View>

        {pendingCount > 0 && isOnline && (
          <TouchableOpacity
            style={styles.syncBtn}
            onPress={syncNow}
            disabled={syncing}
          >
            <Text style={styles.syncBtnText}>
              {syncing ? 'Synchronisation en cours...' : '🔄 Vider & Synchroniser la file'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Replay Onboarding Guide */}
      <TouchableOpacity style={styles.onboardingBtn} onPress={handleReplayOnboarding}>
        <Text style={styles.onboardingBtnText}>📖 Revoir le Guide d'Accueil (Onboarding)</Text>
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Se Déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#15803d',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  email: {
    fontSize: 12,
    color: '#64748b',
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
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roleText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: '#334155',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
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
    color: '#0f172a',
  },
  switchDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  queueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
  },
  queueLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  queueVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  syncBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
  },
  syncBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  onboardingBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  onboardingBtnText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  logoutText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
});
