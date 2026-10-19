import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { mobileApi } from '../../services/api.js';
import { useOffline } from '../../context/OfflineContext.js';
import { SignalementItem } from '../../types/index.js';

export const MesSignalementsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { isOnline, pendingCount, syncNow, syncing } = useOffline();
  const [signalements, setSignalements] = useState<SignalementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMine = async () => {
    try {
      const data = await mobileApi.signalements.getMine();
      setSignalements(data || []);
    } catch {
      // ignore in offline
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMine();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMine();
  };

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case 'SOUMIS':
        return { label: 'Reçu / En attente', bg: '#dbeafe', text: '#1d4ed8' };
      case 'EN_COURS_DE_QUALIFICATION':
        return { label: 'En cours d examen', bg: '#fef3c7', text: '#b45309' };
      case 'ACCEPTE_POUR_RATTACHEMENT':
        return { label: 'Accepté par la Ville', bg: '#ede9fe', text: '#6d28d9' };
      case 'RATTACHE':
        return { label: 'Intégré au Dossier Travaux', bg: '#dcfce7', text: '#15803d' };
      case 'REJETE':
        return { label: 'Rejeté / Hors périmètre', bg: '#fee2e2', text: '#b91c1c' };
      default:
        return { label: statut, bg: '#f1f5f9', text: '#475569' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Offline Pending Banner */}
      {pendingCount > 0 && (
        <View style={styles.offlineBanner}>
          <View style={styles.offlineTextCol}>
            <Text style={styles.offlineTitle}>
              💾 {pendingCount} signalement(s) en attente hors-ligne
            </Text>
            <Text style={styles.offlineSubtitle}>
              {isOnline
                ? 'Connexion rétablie. Vous pouvez synchroniser maintenant.'
                : 'En attente de connexion réseau pour transmission...'}
            </Text>
          </View>
          {isOnline && (
            <TouchableOpacity
              style={styles.syncBtn}
              onPress={async () => {
                await syncNow();
                await fetchMine();
              }}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.syncBtnText}>Synchroniser</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Chargement de vos signalements...</Text>
        </View>
      ) : (
        <FlatList
          data={signalements}
          keyExtractor={(item) => item.idSignalement}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={styles.emptyTitle}>Aucun signalement pour l instant</Text>
              <Text style={styles.emptySubtitle}>
                Vous n avez pas encore signalé de dépôt sauvage. Contribuez à la propreté de votre quartier !
              </Text>
              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => navigation.navigate('NouveauSignalement')}
              >
                <Text style={styles.createBtnText}>+ Signaler une anomalie</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.statutSignalement);
            const dateStr = new Date(item.dateSoumission).toLocaleDateString('fr-SN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <View style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemRef}>
                    SIG-{item.idSignalement.substring(0, 8).toUpperCase()}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </View>

                <Text style={styles.itemDescription} numberOfLines={2}>
                  {item.description}
                </Text>

                <View style={styles.itemFooter}>
                  <Text style={styles.itemLoc}>
                    📍 {item.descriptionLocalisation || (item.latitude ? `${item.latitude.toFixed(4)}, ${item.longitude?.toFixed(4)}` : 'Position Dakar')}
                  </Text>
                  <Text style={styles.itemDate}>{dateStr}</Text>
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
  offlineBanner: {
    backgroundColor: '#fffbeb',
    borderBottomWidth: 1,
    borderColor: '#fef3c7',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  offlineTextCol: {
    flex: 1,
    marginRight: 8,
  },
  offlineTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
  },
  offlineSubtitle: {
    fontSize: 10,
    color: '#78350f',
    marginTop: 2,
  },
  syncBtn: {
    backgroundColor: '#b45309',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemRef: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '800',
    color: '#0f172a',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  itemDescription: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 10,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    paddingTop: 8,
  },
  itemLoc: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
  },
  itemDate: {
    fontSize: 10,
    color: '#94a3b8',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  createBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
