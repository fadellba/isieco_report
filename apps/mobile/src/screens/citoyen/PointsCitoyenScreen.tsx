import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { mobileApi } from '../../services/api.js';
import { PointItem } from '../../types/index.js';
import { useTheme } from '../../context/ThemeContext.js';
import type { DesignTokens } from '@isieco/shared';

export const PointsCitoyenScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [solde, setSolde] = useState<number>(0);
  const [historique, setHistorique] = useState<PointItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPoints = async () => {
    try {
      const data = await mobileApi.points.getMine();
      setSolde(data.soldeTotal || 0);
      setHistorique(data.historique || []);
    } catch {
      // offline fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPoints();
  }, []);

  const getBadgeTitle = (pts: number) => {
    if (pts >= 300) return '🏆 Champion de Salubrité Dakar';
    if (pts >= 150) return '⭐ Sentinelle Urbaine Dakar';
    if (pts >= 50) return '🌿 Éco-Citoyen Engagé';
    return '🌱 Citoyen Vigile';
  };

  return (
    <View style={styles.container}>
      {/* Solde Hero Card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroSubtitle}>VOTRE SOLDE ÉCO-CITOYEN</Text>
        <Text style={styles.heroPoints}>{solde} pts</Text>
        <View style={styles.rankPill}>
          <Text style={styles.rankText}>{getBadgeTitle(solde)}</Text>
        </View>
        <Text style={styles.heroDescription}>
          Gagnez des points à chaque signalement qualifié et validé par les services municipaux de Dakar.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Historique d attribution</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={historique}
          keyExtractor={(item) => item.idPoint}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchPoints();
              }}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                Aucun point pour le moment. Vos points seront crédités dès que vos signalements seront qualifiés.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.pointRow}>
              <View style={styles.pointLeft}>
                <Text style={styles.pointMotif}>{item.motif}</Text>
                <Text style={styles.pointDate}>
                  {new Date(item.dateAttribution).toLocaleDateString('fr-SN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <Text style={styles.pointValue}>+{item.points} pts</Text>
            </View>
          )}
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
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  heroSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.onPrimary,
    letterSpacing: 1,
  },
  heroPoints: {
    fontSize: 42,
    fontWeight: '900',
    color: colors.onPrimary,
    marginVertical: 4,
  },
  rankPill: {
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginVertical: 6,
  },
  rankText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  heroDescription: {
    fontSize: 11,
    color: colors.onPrimary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  list: {
    gap: 8,
  },
  pointRow: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pointLeft: {
    flex: 1,
    marginRight: 10,
  },
  pointMotif: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pointDate: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pointValue: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.primary,
  },
  empty: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
