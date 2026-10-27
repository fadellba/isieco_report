import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { mobileApi } from '../../services/api.js';
import { NotificationItem } from '../../types/index.js';
import { useTheme } from '../../context/ThemeContext.js';
import type { DesignTokens } from '@isieco/shared';

export const NotificationsScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifs = async () => {
    try {
      const data = await mobileApi.notifications.getMine();
      setNotifs(data.data || []);
    } catch {
      // offline fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await mobileApi.notifications.markAsRead(id);
      setNotifs(notifs.map((n) => (n.idNotification === id ? { ...n, lu: true } : n)));
    } catch {
      // ignore
    }
  };

  const unreadCount = notifs.filter((n) => !n.lu).length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Centre de Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unreadCount} non lue(s)</Text>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => item.idNotification}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchNotifs();
              }}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconCircle}>
                <Feather name="bell-off" size={28} color={colors.textSecondary} />
              </View>
              <Text style={styles.emptyText}>Aucune notification récente.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notifCard, !item.lu && styles.notifCardUnread]}
              onPress={() => !item.lu && handleMarkAsRead(item.idNotification)}
            >
              <View style={styles.notifHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                  {!item.lu && <View style={styles.unreadDot} />}
                  <Text style={[styles.notifTitle, !item.lu && styles.notifTitleBold]}>
                    {item.titre}
                  </Text>
                </View>
                <Text style={styles.notifDate}>
                  {new Date(item.dateCreation).toLocaleDateString('fr-SN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>

              <Text style={styles.notifMessage}>{item.message}</Text>
            </TouchableOpacity>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  unreadBadge: {
    backgroundColor: colors.infoSurface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  unreadText: {
    color: colors.info,
    fontSize: 10,
    fontWeight: '700',
  },
  list: {
    gap: 8,
  },
  notifCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notifCardUnread: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  notifTitle: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  notifTitleBold: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  notifDate: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  notifMessage: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
