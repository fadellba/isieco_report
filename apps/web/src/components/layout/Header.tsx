import React, { useState, useEffect } from 'react';
import type { NotificationItem, NotificationsResponse } from '@isieco/shared';
import { useAuth } from '../../context/AuthContext.js';
import { Bell, Leaf, LogOut, User, ShieldCheck } from 'lucide-react';
import { api } from '../../api/client.js';
import { Link } from 'react-router-dom';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get<NotificationsResponse>('/notifications');
      setNotifications(res.data || []);
      setUnreadCount(res.nonLues || 0);
      setNotificationError(null);
    } catch (error) {
      setNotificationError(
        error instanceof Error ? error.message : 'Impossible de charger les notifications.'
      );
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // Polling toutes les 30s
      return () => clearInterval(interval);
    }
  }, [user]);

  const markAsRead = async (idNotif: string) => {
    try {
      await api.patch(`/notifications/${idNotif}/lu`);
      setNotifications((prev) =>
        prev.map((n) => (n.idNotification === idNotif ? { ...n, lu: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotificationError(null);
    } catch (error) {
      setNotificationError(
        error instanceof Error ? error.message : 'Impossible de marquer la notification comme lue.'
      );
    }
  };

  return (
    <header className="ops-header sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-isieco-border bg-isieco-surface px-5">
      <div className="ops-header__brand flex items-center gap-3">
        <div className="ops-header__brand-icon flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-950 text-emerald-300 ring-1 ring-emerald-800/70">
          <Leaf aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-isieco-dark leading-tight flex items-center gap-2">
            ISI-Eco Report
            <span className="ops-header__version rounded bg-emerald-950/70 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-900">
              OPS • DAKAR
            </span>
          </h1>
          <p className="ops-header__subtitle text-[11px] text-isieco-muted">
            Signalements <span>·</span> Collecte <span>·</span> Cadre de vie
          </p>
        </div>
      </div>

      <div className="ops-header__controls flex items-center gap-4">
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-lg p-2 text-isieco-muted hover:bg-gray-100 hover:text-isieco-dark focus:outline-none"
            title="Notifications internes"
            aria-label={`Notifications internes${unreadCount > 0 ? `, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : ''}`}
            aria-expanded={showNotifications}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-isieco-border bg-white p-3 shadow-xl z-50">
              <div className="flex items-center justify-between border-b border-isieco-border pb-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-isieco-dark">
                  Notifications ({unreadCount} non lues)
                </span>
              </div>
              {notificationError && (
                <p className="mb-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700" role="alert">
                  {notificationError}
                </p>
              )}
              <div className="max-h-72 overflow-y-auto space-y-2">
                {notifications.length === 0 ? (
                  <p className="text-xs text-isieco-muted text-center py-4">Aucune notification.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.idNotification}
                      onClick={() => !n.lu && markAsRead(n.idNotification)}
                      className={`cursor-pointer rounded-lg p-2 text-xs transition-colors ${
                        n.lu ? 'bg-gray-50 text-gray-600' : 'bg-emerald-50/60 text-isieco-dark font-medium border-l-2 border-isieco-primary'
                      }`}
                    >
                      <div className="font-semibold text-isieco-dark">{n.titre}</div>
                      <div className="mt-0.5 text-isieco-muted leading-relaxed">{n.message}</div>
                      <div className="mt-1 text-[10px] text-gray-400">
                        {new Date(n.dateCreation).toLocaleTimeString('fr-SN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {user && (
          <div className="ops-header__profile flex items-center gap-3 border-l border-isieco-border pl-4">
            <Link
              to="/profil"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200 hover:border-emerald-700"
              title="Ouvrir mon profil et les paramètres"
              aria-label="Ouvrir mon profil et les paramètres"
            >
              <User className="h-4 w-4" />
            </Link>
            <Link to="/profil" className="ops-header__identity hidden sm:block text-left" title="Mon profil">
              <div className="text-xs font-bold text-isieco-dark">
                {user.prenom ? `${user.prenom} ${user.nom}` : user.nom}
              </div>
              <div className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-isieco-primary" />
                <span className="text-[10px] font-medium text-isieco-muted">
                  {user.roles.length > 1 ? `Équipe métier · ${user.roles.length} rôles` : user.roles.join(', ')}
                </span>
              </div>
            </Link>
            <button
              onClick={() => logout()}
              className="rounded-lg p-2 text-isieco-muted hover:bg-rose-50 hover:text-rose-600 transition-colors"
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
