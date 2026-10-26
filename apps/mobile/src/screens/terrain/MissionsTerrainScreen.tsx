import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { mobileApi } from '../../services/api.js';
import { MissionTerrainItem } from '../../types/index.js';
import { useTheme } from '../../context/ThemeContext.js';
import type { DesignTokens } from '@isieco/shared';

export const MissionsTerrainScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [missions, setMissions] = useState<MissionTerrainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchMissions = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await mobileApi.interventions.getMissions();
      setMissions(data || []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Impossible de charger les missions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setFeedback(null);
      void fetchMissions();
    }, [fetchMissions])
  );

  const handleStartIntervention = async (id: string) => {
    setStartingId(id);
    setFeedback(null);
    try {
      await mobileApi.interventions.demarrer(id);
      const message = 'Le début des opérations sur site a été tracé dans le journal.';
      if (Platform.OS === 'web') {
        setFeedback({ type: 'success', message });
      } else {
        Alert.alert('Intervention démarrée', message);
      }
      await fetchMissions();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de démarrer l intervention.';
      if (Platform.OS === 'web') {
        setFeedback({ type: 'error', message });
      } else {
        Alert.alert('Erreur', message);
      }
    } finally {
      setStartingId(null);
    }
  };

  const getPriorityStyle = (prio: string) => {
    switch (prio) {
      case 'URGENTE':
        return { bg: colors.dangerSurface, text: colors.danger };
      case 'ELEVEE':
        return { bg: colors.warningSurface, text: colors.warning };
      case 'MOYENNE':
        return { bg: colors.infoSurface, text: colors.info };
      default:
        return { bg: colors.surfaceRaised, text: colors.textSecondary };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Missions de Salubrité</Text>
        <Text style={styles.subtitle}>
          Interventions dakarises attribuées à votre équipe technique
        </Text>
      </View>

      {feedback && (
        <View
          accessibilityRole={feedback.type === 'error' ? 'alert' : 'status'}
          style={[styles.feedback, feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess]}
        >
          <Text style={styles.feedbackText}>{feedback.message}</Text>
        </View>
      )}

      {loadError && (
        <View accessibilityRole="alert" style={[styles.feedback, styles.feedbackError]}>
          <Text style={styles.feedbackText}>{loadError}</Text>
          <TouchableOpacity
            onPress={() => {
              setLoading(true);
              void fetchMissions();
            }}
          >
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement des missions...</Text>
        </View>
      ) : (
        <FlatList
          data={missions}
          keyExtractor={(item) => item.idIntervention}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void fetchMissions();
              }}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🚛</Text>
              <Text style={styles.emptyTitle}>Aucune intervention en attente</Text>
              <Text style={styles.emptySubtitle}>
                Toutes les missions de votre équipe sont à jour.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const prioStyle = getPriorityStyle(item.priorite);
            const isEnCours = item.statutIntervention === 'EN_COURS';
            const isTerminee = item.statutIntervention === 'TERMINEE';

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.dossierRef}>{item.referenceDossier}</Text>
                    <Text style={styles.equipeName}>Équipe : {item.nomEquipe}</Text>
                  </View>
                  <View style={[styles.prioBadge, { backgroundColor: prioStyle.bg }]}>
                    <Text style={[styles.prioText, { color: prioStyle.text }]}>
                      {item.priorite}
                    </Text>
                  </View>
                </View>

                {/* Volet Technique */}
                <View style={styles.voletBox}>
                  <Text style={styles.voletLabel}>VOLET TECHNIQUE DAKAR :</Text>
                  <Text style={styles.voletVal}>{item.libelleDechet}</Text>
                </View>

                <Text style={styles.desc} numberOfLines={2}>
                  {item.descriptionSynthese}
                </Text>

                <View style={styles.locRow}>
                  <Text style={styles.locText}>
                    📍 {item.descriptionLocalisation || (item.latitude ? `${item.latitude.toFixed(4)}, ${item.longitude?.toFixed(4)}` : 'Secteur communal')}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                  {!isEnCours && !isTerminee && (
                    <TouchableOpacity
                      style={styles.startBtn}
                      onPress={() => handleStartIntervention(item.idIntervention)}
                      disabled={startingId === item.idIntervention}
                    >
                      {startingId === item.idIntervention ? (
                        <ActivityIndicator color={colors.onPrimary} size="small" />
                      ) : (
                        <Text style={styles.startBtnText}>▶ Démarrer sur site</Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {isEnCours ? (
                    <TouchableOpacity
                      style={[styles.reportBtn, isEnCours && styles.reportBtnPrimary]}
                      onPress={() => navigation.navigate('CompteRendu', { mission: item })}
                    >
                      <Text style={[styles.reportBtnText, isEnCours && styles.reportBtnTextPrimary]}>
                        📝 Clôturer & Rapport
                      </Text>
                    </TouchableOpacity>
                  ) : !isTerminee ? (
                    <Text style={styles.loadingText}>Démarrez l’intervention pour saisir le rapport.</Text>
                  ) : (
                    <View style={styles.donePill}>
                      <Text style={styles.doneText}>✓ Mission Terminée</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const createStyles = (colors: DesignTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  header: {
    marginBottom: 14,
  },
  feedback: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  feedbackError: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.danger,
  },
  feedbackSuccess: {
    backgroundColor: colors.successSurface,
    borderColor: colors.success,
  },
  feedbackText: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 17,
  },
  retryText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textSecondary,
  },
  list: {
    gap: 12,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  dossierRef: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  equipeName: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  prioBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  prioText: {
    fontSize: 10,
    fontWeight: '800',
  },
  voletBox: {
    backgroundColor: colors.infoSurface,
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  voletLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.info,
  },
  voletVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.info,
    marginTop: 1,
  },
  desc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
  },
  locRow: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 8,
    marginBottom: 12,
  },
  locText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  startBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  startBtnText: {
    color: colors.onPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  reportBtn: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  reportBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  reportBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  reportBtnTextPrimary: {
    color: colors.onPrimary,
  },
  donePill: {
    backgroundColor: colors.successSurface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  doneText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '800',
  },
  empty: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
