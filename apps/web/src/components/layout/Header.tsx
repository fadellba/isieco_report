import React, { useState, useEffect } from 'react';
import type { NotificationItem, NotificationsResponse } from '@isieco/shared';
import { useAuth } from '../../context/AuthContext.js';
import { Bell, Leaf, LogOut, User, ShieldCheck, Menu, X, Check } from 'lucide-react';
import { api } from '../../api/client.js';
import { Link } from 'react-router-dom';

interface HeaderProps {
  navigationOpen: boolean;
  onToggleNavigation: () => void;
}

export const Header: React.FC<HeaderProps> = ({ navigationOpen, onToggleNavigation }) => {
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
      const interval = setInterval(fetchNotifications, 30000);
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
    <header className="app-header">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="app-header__menu flex h-9 w-9 items-center justify-center rounded-lg border border-isieco-border bg-white text-isieco-muted hover:border-isieco-primary hover:text-isieco-primary transition-colors cursor-pointer"
          onClick={onToggleNavigation}
          aria-label={navigationOpen ? 'Fermer la navigation' : 'Ouvrir la navigation'}
          aria-controls="ops-primary-navigation"
          aria-expanded={navigationOpen}
        >
          {navigationOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-isieco-primary to-isieco-primary-light text-white shadow-sm">
          <Leaf aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-isieco-dark leading-tight flex items-center gap-2">
            ISI-Eco Report
            <span className="rounded-md bg-isieco-primary-subtle px-2 py-0.5 text-[10px] font-bold text-isieco-primary border border-isieco-primary/20">
              DAKAR
            </span>
          </h1>
          <p className="text-[11px] text-isieco-muted">
            Signalements <span className="text-isieco-primary">·</span> Collecte <span className="text-isieco-primary">·</span> Cadre de vie
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-isieco-muted hover:bg-isieco-primary-subtle hover:text-isieco-primary transition-colors cursor-pointer"
            title="Notifications internes"
            aria-label={`Notifications internes${unreadCount > 0 ? `, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : ''}`}
            aria-expanded={showNotifications}
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-isieco-destructive text-[10px] font-bold text-white px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="notification-dropdown">
              <div className="flex items-center justify-between border-b border-isieco-border pb-2.5 mb-2.5">
                <span className="text-xs font-bold text-isieco-dark">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="status-badge status-badge--info">
                    {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {notificationError && (
                <p className="mb-2 rounded-lg border border-red-200 bg-isieco-destructive-subtle p-2.5 text-xs text-isieco-destructive" role="alert">
                  {notificationError}
                </p>
              )}
              <div className="max-h-72 overflow-y-auto space-y-1.5">
                {notifications.length === 0 ? (
                  <div className="empty-state py-6">
                    <Bell size={24} />
                    <span className="text-xs">Aucune notification</span>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      type="button"
                      key={n.idNotification}
                      onClick={() => !n.lu && markAsRead(n.idNotification)}
                      className={`w-full text-left rounded-lg p-2.5 text-xs transition-all cursor-pointer ${
                        n.lu
                          ? 'bg-transparent text-isieco-muted hover:bg-gray-50'
                          : 'bg-isieco-primary-subtle text-isieco-dark border-l-2 border-isieco-primary hover:bg-emerald-100/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-isieco-dark">{n.titre}</span>
                        {n.lu && <Check size={14} className="text-isieco-primary shrink-0 mt-0.5" />}
                      </div>
                      <div className="mt-1 text-isieco-muted leading-relaxed">{n.message}</div>
                      <div className="mt-1.5 text-[10px] text-slate-400">
                        {new Date(n.dateCreation).toLocaleTimeString('fr-SN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        {user && (
          <div className="flex items-center gap-3 border-l border-isieco-border pl-3">
            <Link
              to="/profil"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-isieco-primary to-isieco-primary-light text-white text-sm font-bold shadow-sm hover:shadow-md transition-shadow"
              title="Ouvrir mon profil et les paramètres"
              aria-label="Ouvrir mon profil et les paramètres"
            >
              {user.prenom ? user.prenom[0].toUpperCase() : <User className="h-4 w-4" />}
            </Link>
            <Link to="/profil" className="hidden sm:block text-left" title="Mon profil">
              <div className="text-xs font-bold text-isieco-dark">
                {user.prenom ? `${user.prenom} ${user.nom}` : user.nom}
              </div>
              <div className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-isieco-primary" />
                <span className="text-[10px] font-medium text-isieco-muted">
                  {user.roles.length > 1 ? `${user.roles.length} rôles métier` : user.roles.join(', ')}
                </span>
              </div>
            </Link>
            <button
              onClick={() => logout()}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-isieco-muted hover:bg-isieco-destructive-subtle hover:text-isieco-destructive transition-colors cursor-pointer"
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
