import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext.js';
import { setApiBaseUrl, getApiBaseUrl } from '../../services/api.js';
import { useTheme } from '../../context/ThemeContext.js';
import { ThemePreferenceControl } from '../../components/ThemePreferenceControl.js';
import { Logo } from '../../components/Logo.js';
import type { DesignTokens } from '@isieco/shared';

export const LoginScreen: React.FC = () => {
  const { login, quickLoginAsPersona, loading, initializationError } = useAuth();
  const { colors, theme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());

  React.useEffect(() => {
    if (initializationError) {
      Alert.alert('Session indisponible', initializationError);
    }
  }, [initializationError]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Champs requis', 'Veuillez renseigner votre email et mot de passe.');
      return;
    }
    try {
      await login(email, password);
    } catch (err: any) {
      Alert.alert('Échec de connexion', err.message || 'Identifiants invalides.');
    }
  };

  const handlePersona = async (pEmail: string, pPass: string) => {
    try {
      await quickLoginAsPersona(pEmail, pPass);
    } catch (err: any) {
      Alert.alert('Échec de connexion', err.message || 'Impossible de se connecter.');
    }
  };

  const handleSaveApiUrl = async () => {
    try {
      await setApiBaseUrl(apiUrl);
      Alert.alert('Configuration', `URL API mise à jour : ${apiUrl}`);
      setShowConfig(false);
    } catch (error) {
      Alert.alert(
        'URL API invalide',
        error instanceof Error ? error.message : 'Impossible de sauvegarder cette URL.',
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Brand Header with Official Logo */}
      <View style={styles.header}>
        <Logo size="medium" showSubtitle={true} tone={theme === 'dark' ? 'dark' : 'light'} />
        <Text style={styles.subtitle}>
          Application Nomade Citoyens & Agents de Terrain (Plateau & Médina)
        </Text>
      </View>

      <View style={styles.themeControl}>
        <ThemePreferenceControl />
      </View>

      {/* Login Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Connexion Mobile</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="votre.email@exemple.sn"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••••••"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Se connecter</Text>
          )}
        </TouchableOpacity>
      </View>

      {__DEV__ && (
        <View style={styles.personaSection}>
          <Text style={styles.personaTitle}>Comptes de Test Dakar (Accès 1-Clic)</Text>
          <Text style={styles.personaSubtitle}>Sélectionnez un profil pour vous connecter sans mot de passe :</Text>

          <View style={styles.personaGrid}>
            <TouchableOpacity
              style={styles.personaBtn}
              onPress={() => handlePersona('citoyen@isieco.sn', 'Password@123')}
            >
              <Text style={styles.personaRole}>CITOYEN</Text>
              <Text style={styles.personaName}>Awa Diallo</Text>
              <Text style={styles.personaLoc}>Compte de démonstration</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.personaBtn}
              onPress={() => handlePersona('citoyen2@isieco.sn', 'Password@123')}
            >
              <Text style={styles.personaRole}>CITOYEN</Text>
              <Text style={styles.personaName}>Babacar Seck</Text>
              <Text style={styles.personaLoc}>Compte de démonstration</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.personaBtn, styles.personaBtnTerrain]}
              onPress={() => handlePersona('terrain@isieco.sn', 'Password@123')}
            >
              <Text style={styles.personaRoleTerrain}>AGENT TERRAIN</Text>
              <Text style={styles.personaName}>Modou Fall</Text>
              <Text style={styles.personaLoc}>Compte de démonstration</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Network Configuration toggle */}
      {__DEV__ && (
        <>
          <TouchableOpacity
            style={styles.configToggle}
            onPress={() => setShowConfig(!showConfig)}
          >
            <Text style={styles.configToggleText}>
              {showConfig ? 'Masquer config réseau' : '⚙ Paramètres réseau (URL API)'}
            </Text>
          </TouchableOpacity>

          {showConfig && <View style={styles.configCard}>
          <Text style={styles.configLabel}>Base URL de l'API Fastify :</Text>
          <TextInput
            style={styles.configInput}
            value={apiUrl}
            onChangeText={setApiUrl}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.configSaveBtn} onPress={handleSaveApiUrl}>
            <Text style={styles.configSaveText}>Appliquer l'URL</Text>
          </TouchableOpacity>
          </View>}
        </>
      )}
    </ScrollView>
  );
};

const createStyles = (colors: DesignTokens) => StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: colors.background,
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  badge: {
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  themeControl: {
    marginBottom: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: {
    backgroundColor: colors.primary,
    opacity: 0.65,
  },
  buttonText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  personaSection: {
    marginTop: 28,
  },
  personaTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    textTransform: 'uppercase',
  },
  personaSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  personaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  personaBtn: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
  },
  personaBtnTerrain: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  personaRole: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.brandGreen,
  },
  personaRoleTerrain: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.info,
  },
  personaName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  personaLoc: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  configToggle: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 8,
  },
  configToggleText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  configCard: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  configLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
  },
  configInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    color: colors.textPrimary,
  },
  configSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  configSaveText: {
    color: colors.onPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
});
