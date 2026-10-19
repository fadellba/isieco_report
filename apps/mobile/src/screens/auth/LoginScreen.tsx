import React, { useState } from 'react';
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

import { Logo } from '../../components/Logo.js';

export const LoginScreen: React.FC = () => {
  const { login, quickLoginAsPersona, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());

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
    await setApiBaseUrl(apiUrl);
    Alert.alert('Configuration', `URL API mise à jour : ${apiUrl}`);
    setShowConfig(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Brand Header with Official Logo */}
      <View style={styles.header}>
        <Logo size="medium" showSubtitle={true} />
        <Text style={styles.subtitle}>
          Application Nomade Citoyens & Agents de Terrain (Plateau & Médina)
        </Text>
      </View>

      {/* Login Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Connexion Mobile</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="votre.email@exemple.sn"
            placeholderTextColor="#94a3b8"
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
            placeholderTextColor="#94a3b8"
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
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Se connecter</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Quick Personas Demo Shortcuts */}
      <View style={styles.personaSection}>
        <Text style={styles.personaTitle}>Comptes de Test Dakar (Accès 1-Clic)</Text>
        <Text style={styles.personaSubtitle}>Sélectionnez un profil pour vous connecter sans mot de passe :</Text>

        <View style={styles.personaGrid}>
          <TouchableOpacity
            style={styles.personaBtn}
            onPress={() => handlePersona('fatou.ba@citoyen.sn', 'Citoyen2026!')}
          >
            <Text style={styles.personaRole}>CITOYEN</Text>
            <Text style={styles.personaName}>Fatou Ba</Text>
            <Text style={styles.personaLoc}>Dakar-Plateau</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.personaBtn}
            onPress={() => handlePersona('moussa.sow@citoyen.sn', 'Citoyen2026!')}
          >
            <Text style={styles.personaRole}>CITOYEN</Text>
            <Text style={styles.personaName}>Moussa Sow</Text>
            <Text style={styles.personaLoc}>Médina</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.personaBtn, styles.personaBtnTerrain]}
            onPress={() => handlePersona('cheikh.diop@terrain.dakar.sn', 'Terrain2026!')}
          >
            <Text style={styles.personaRoleTerrain}>AGENT TERRAIN</Text>
            <Text style={styles.personaName}>Cheikh Diop</Text>
            <Text style={styles.personaLoc}>Équipe Plateau</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.personaBtn, styles.personaBtnTerrain]}
            onPress={() => handlePersona('aissatou.fall@terrain.dakar.sn', 'Terrain2026!')}
          >
            <Text style={styles.personaRoleTerrain}>AGENT TERRAIN</Text>
            <Text style={styles.personaName}>Aïssatou Fall</Text>
            <Text style={styles.personaLoc}>Équipe Médina</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Network Configuration toggle */}
      <TouchableOpacity
        style={styles.configToggle}
        onPress={() => setShowConfig(!showConfig)}
      >
        <Text style={styles.configToggleText}>
          {showConfig ? 'Masquer config réseau' : '⚙ Paramètres réseau (URL API)'}
        </Text>
      </TouchableOpacity>

      {showConfig && (
        <View style={styles.configCard}>
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
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#f8fafc',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  badge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  badgeText: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  button: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: {
    backgroundColor: '#86efac',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  personaSection: {
    marginTop: 28,
  },
  personaTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
    textTransform: 'uppercase',
  },
  personaSubtitle: {
    fontSize: 11,
    color: '#64748b',
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
  },
  personaBtnTerrain: {
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
  },
  personaRole: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16a34a',
  },
  personaRoleTerrain: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2563eb',
  },
  personaName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  personaLoc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  configToggle: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 8,
  },
  configToggleText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  configCard: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
  },
  configLabel: {
    fontSize: 11,
    color: '#475569',
    marginBottom: 6,
    fontWeight: '600',
  },
  configInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    color: '#0f172a',
  },
  configSaveBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  configSaveText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
