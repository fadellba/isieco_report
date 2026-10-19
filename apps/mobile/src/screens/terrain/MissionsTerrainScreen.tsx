import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { mobileApi } from '../../services/api.js';
import { MissionTerrainItem } from '../../types/index.js';

export const MissionsTerrainScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [missions, setMissions] = useState<MissionTerrainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  const fetchMissions = async () => {
    try {
      const data = await mobileApi.interventions.getMissions();
      setMissions(data || []);
    } catch (err: any) {
      // offline
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMissions();
  }, []);

  const handleStartIntervention = async (id: string) => {
    setStartingId(id);
    try {
      await mobileApi.interventions.demarrer(id);
      Alert.alert('Intervention démarrée', 'Le début des opérations sur site a été tracé dans le journal.');
      await fetchMissions();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de démarrer l intervention.');
    } finally {
      setStartingId(null);
    }
  };

  const getPriorityStyle = (prio: string) => {
    switch (prio) {
      case 'URGENTE':
        return { bg: '#fee2e2', text: '#b91c1c' };
      case 'ELEVEE':
        return { bg: '#ffedd5', text: '#c2410c' };
      case 'MOYENNE':
        return { bg: '#fef3c7', text: '#b45309' };
      default:
        return { bg: '#f1f5f9', text: '#475569' };
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
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
                fetchMissions();
              }}
              colors={['#16a34a']}
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
                        <ActivityIndicator color="#ffffff" size="small" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
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
    color: '#64748b',
  },
  list: {
    gap: 12,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    color: '#0f172a',
    fontFamily: 'monospace',
  },
  equipeName: {
    fontSize: 11,
    color: '#64748b',
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
    backgroundColor: '#eff6ff',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  voletLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  voletVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e3a8a',
    marginTop: 1,
  },
  desc: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
    marginBottom: 8,
  },
  locRow: {
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    paddingTop: 8,
    marginBottom: 12,
  },
  locText: {
    fontSize: 11,
    color: '#64748b',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  startBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  reportBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  reportBtnPrimary: {
    backgroundColor: '#16a34a',
    borderColor: '#15803d',
  },
  reportBtnText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  reportBtnTextPrimary: {
    color: '#ffffff',
  },
  donePill: {
    backgroundColor: '#dcfce7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  doneText: {
    color: '#15803d',
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
    color: '#0f172a',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
});
