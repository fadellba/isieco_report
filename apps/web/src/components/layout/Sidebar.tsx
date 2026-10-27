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
  section?: string;
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
    section: 'Tableau de bord',
  },
  {
    to: '/qualification',
    label: 'Qualification & Doublons',
    icon: Inbox,
    roles: [RoleCode.QUALIFICATION, RoleCode.TRAITEMENT],
    section: 'Opérations',
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
    label: 'Affectations',
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
    section: 'Analyse',
  },
  {
    to: '/statistiques',
    label: 'Impact & Indicateurs',
    icon: BarChart3,
    roles: [RoleCode.DECISION, RoleCode.TRAITEMENT, RoleCode.ADMIN],
  },
  {
    to: '/audit',
    label: 'Traçabilité',
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
    section: 'Administration',
  },
  {
    to: '/referentiels',
    label: 'Référentiels',
    icon: BookOpen,
    roles: [RoleCode.ADMIN],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onNavigate: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onNavigate }) => {
  const { hasAnyRole } = useAuth();

  let lastSection: string | undefined;

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="app-sidebar__backdrop"
          aria-label="Fermer le menu de navigation"
          onClick={onNavigate}
        />
      )}
      <aside
        className="app-sidebar"
        data-open={isOpen}
      >
        <nav id="ops-primary-navigation" className="space-y-0.5" aria-label="Navigation principale">
          {NAV_ITEMS.map((item) => {
            if (!hasAnyRole(item.roles)) return null;

            const Icon = item.icon;
            const showSection = item.section && item.section !== lastSection;
            if (item.section) lastSection = item.section;

            return (
              <React.Fragment key={item.to}>
                {showSection && (
                  <div className="flex items-center gap-2 px-3 pb-1 pt-4 first:pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-isieco-muted/70">
                      {item.section}
                    </span>
                    <div className="flex-1 h-px bg-isieco-border/60" />
                  </div>
                )}
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  aria-label={item.label}
                  title={item.label}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-isieco-primary to-isieco-primary-light text-white shadow-md shadow-isieco-primary/20'
                        : 'text-isieco-muted hover:bg-isieco-primary/5 hover:text-isieco-primary'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Territory Card */}
        <div className="sidebar-territory mt-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-isieco-primary">
            <span className="h-2 w-2 rounded-full bg-isieco-primary shadow-sm shadow-isieco-primary/50" />
            TERRITOIRE PILOTE
          </div>
          <div className="mt-1.5 pl-4 text-[12px] font-semibold text-isieco-dark">
            Dakar-Plateau & Médina
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-isieco-border pt-2.5 text-[10px] text-isieco-muted">
            <Recycle aria-hidden="true" size={13} className="text-isieco-primary" />
            <span>Signaler · Agir · Préserver</span>
          </div>
        </div>
      </aside>
    </>
  );
};
