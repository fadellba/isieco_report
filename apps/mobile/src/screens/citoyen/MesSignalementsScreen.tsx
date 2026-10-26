import React, { useEffect, useMemo, useState } from 'react';
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
import { useOffline } from '../../context/OfflineContext.js';
import { SignalementItem } from '../../types/index.js';
import { useTheme } from '../../context/ThemeContext.js';
import type { DesignTokens } from '@isieco/shared';

export const MesSignalementsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { isOnline, pendingCount, syncNow, syncing } = useOffline();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
        return { label: 'Reçu / En attente', bg: colors.infoSurface, text: colors.info };
      case 'EN_COURS_DE_QUALIFICATION':
        return { label: 'En cours d’examen', bg: colors.warningSurface, text: colors.warning };
      case 'ACCEPTE_POUR_RATTACHEMENT':
        return { label: 'Accepté par la Ville', bg: colors.infoSurface, text: colors.info };
      case 'RATTACHE':
        return { label: 'Intégré au Dossier Travaux', bg: colors.successSurface, text: colors.success };
      case 'REJETE':
        return { label: 'Rejeté / Hors périmètre', bg: colors.dangerSurface, text: colors.danger };
      default:
        return { label: statut, bg: colors.surfaceRaised, text: colors.textSecondary };
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
                const result = await syncNow();
                if (result.failed > 0) {
                  Alert.alert(
                    'Synchronisation partielle',
                    `${result.synced} action(s) envoyée(s). ${result.failed} action(s) restent en attente.`,
                  );
                }
                await fetchMine();
              }}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator color={colors.warning} size="small" />
              ) : (
                <Text style={styles.syncBtnText}>Synchroniser</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement de vos signalements...</Text>
        </View>
      ) : (
        <FlatList
          data={signalements}
          keyExtractor={(item) => item.idSignalement}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
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

const createStyles = (colors: DesignTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  offlineBanner: {
    backgroundColor: colors.warningSurface,
    borderBottomWidth: 1,
    borderColor: colors.warning,
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
    color: colors.warning,
  },
  offlineSubtitle: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  syncBtn: {
    backgroundColor: colors.warningSurface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncBtnText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textPrimary,
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
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 8,
  },
  itemLoc: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  itemDate: {
    fontSize: 10,
    color: colors.textSecondary,
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
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  createBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createBtnText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
});
