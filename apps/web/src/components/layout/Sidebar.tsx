import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { RoleCode } from '@isieco/shared';
import {
  Inbox,
  Leaf,
  FolderKanban,
  GitFork,
  CheckCircle2,
  MapPin,
  Recycle,
  BarChart3,
  ScrollText,
  Users,
  LayoutDashboard,
  Truck,
  BookOpen,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: RoleCode[];
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Vue opérationnelle',
    icon: LayoutDashboard,
    roles: [
      RoleCode.QUALIFICATION,
      RoleCode.TRAITEMENT,
      RoleCode.AFFECTATION,
      RoleCode.VERIFICATION,
      RoleCode.DECISION,
      RoleCode.ADMIN,
    ],
  },
  {
    to: '/qualification',
    label: 'Qualification & Doublons',
    icon: Inbox,
    roles: [RoleCode.QUALIFICATION, RoleCode.TRAITEMENT],
  },
  {
    to: '/interventions',
    label: 'Missions terrain',
    icon: Truck,
    roles: [
      RoleCode.QUALIFICATION,
      RoleCode.AFFECTATION,
      RoleCode.TRAITEMENT,
      RoleCode.VERIFICATION,
      RoleCode.DECISION,
      RoleCode.ADMIN,
    ],
  },
  {
    to: '/dossiers',
    label: 'Dossiers Opérationnels',
    icon: FolderKanban,
    roles: [RoleCode.TRAITEMENT, RoleCode.AFFECTATION],
  },
  {
    to: '/affectations',
    label: 'Affectations par Volet',
    icon: GitFork,
    roles: [RoleCode.AFFECTATION],
  },
  {
    to: '/verifications',
    label: 'Contrôle & Clôture',
    icon: CheckCircle2,
    roles: [RoleCode.VERIFICATION],
  },
  {
    to: '/carte',
    label: 'Cartographie Dakar',
    icon: MapPin,
    roles: [
      RoleCode.DECISION,
      RoleCode.QUALIFICATION,
      RoleCode.TRAITEMENT,
      RoleCode.AFFECTATION,
      RoleCode.VERIFICATION,
      RoleCode.ADMIN,
    ],
  },
  {
    to: '/statistiques',
    label: 'Impact & Indicateurs',
    icon: BarChart3,
    roles: [RoleCode.DECISION, RoleCode.TRAITEMENT, RoleCode.ADMIN],
  },
  {
    to: '/audit',
    label: 'Traçabilité environnementale',
    icon: ScrollText,
    roles: [
      RoleCode.ADMIN,
      RoleCode.QUALIFICATION,
      RoleCode.TRAITEMENT,
      RoleCode.AFFECTATION,
      RoleCode.VERIFICATION,
      RoleCode.DECISION,
    ],
  },
  {
    to: '/admin',
    label: 'Équipe & Accès',
    icon: Users,
    roles: [RoleCode.ADMIN],
  },
  {
    to: '/referentiels',
    label: 'Référentiels',
    icon: BookOpen,
    roles: [RoleCode.ADMIN],
  },
];

export const Sidebar: React.FC = () => {
  const { hasAnyRole } = useAuth();

  return (
    <aside className="ops-sidebar w-60 shrink-0 border-r border-isieco-border bg-isieco-surface min-h-[calc(100vh-4rem)] p-3 flex flex-col justify-between">
      <nav className="space-y-1.5">
        <div className="ops-sidebar__section-label px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-isieco-muted">
          <Leaf aria-hidden="true" size={13} />
          Écosystème urbain · Dakar
        </div>
        {NAV_ITEMS.map((item) => {
          if (!hasAnyRole(item.roles)) return null;

          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.label}
              title={item.label}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-950/70 text-emerald-300 ring-1 ring-emerald-800/70'
                    : 'text-gray-700 hover:bg-emerald-950/40 hover:text-emerald-300'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="ops-sidebar__territory rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs text-isieco-muted">
        <div className="flex items-center gap-2 font-semibold text-isieco-dark">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          TERRITOIRE PILOTE
        </div>
        <div className="ops-sidebar__place mt-1 pl-4 text-[11px]">Dakar-Plateau & Médina</div>
        <div className="ops-sidebar__cycle mt-3 border-t border-isieco-border pt-2 text-[10px]">
          <Recycle aria-hidden="true" size={13} />
          <span>Signaler · Agir · Préserver</span>
        </div>
      </div>
    </aside>
  );
};
