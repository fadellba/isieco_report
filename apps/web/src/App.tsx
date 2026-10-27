import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { RoleCode } from '@isieco/shared';
import { Header } from './components/layout/Header.js';
import { Sidebar } from './components/layout/Sidebar.js';

// Pages
import { LoginPage } from './pages/LoginPage.js';
import { QualificationPage } from './pages/QualificationPage.js';
import { DossiersPage } from './pages/DossiersPage.js';
import { AffectationsPage } from './pages/AffectationsPage.js';
import { VerificationsPage } from './pages/VerificationsPage.js';
import { CarteDakarPage } from './pages/CarteDakarPage.js';
import { StatistiquesPage } from './pages/StatistiquesPage.js';
import { AuditPage } from './pages/AuditPage.js';
import { AdminComptesPage } from './pages/AdminComptesPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { ReferentielsPage } from './pages/ReferentielsPage.js';
import { ShieldAlert, RefreshCw } from 'lucide-react';

const ProtectedLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const [navigationOpen, setNavigationOpen] = useState(false);

  useEffect(() => {
    if (!navigationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavigationOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [navigationOpen]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-isieco-bg to-emerald-50">
        <div className="glass-card p-8 flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-isieco-primary to-isieco-primary-light flex items-center justify-center text-white shadow-lg shadow-isieco-primary/20">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
          <span className="text-sm font-medium text-isieco-muted">Vérification de la session communale...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <Header
        onToggleNavigation={() => setNavigationOpen((open) => !open)}
        navigationOpen={navigationOpen}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar isOpen={navigationOpen} onNavigate={() => setNavigationOpen(false)} />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const RequireRole: React.FC<{ roles?: RoleCode[]; children: React.ReactNode }> = ({
  roles,
  children,
}) => {
  const { user, hasAnyRole } = useAuth();

  if (roles && !hasAnyRole(roles)) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
         <div className="glass-card-solid max-w-md p-6 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-xl bg-isieco-destructive-subtle flex items-center justify-center text-isieco-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-isieco-dark">Accès Non Autorisé</h2>
          <p className="text-xs text-isieco-muted">
            Votre profil ({user?.roles.join(', ')}) ne dispose pas des privilèges nécessaires.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          {/* Authentification publique */}
          <Route path="/login" element={<LoginPage />} />

          {/* Espace Opérationnel Protégé */}
          <Route element={<ProtectedLayout />}>
            <Route path="/profil" element={<ProfilePage />} />
            <Route
              path="/"
              element={
                <RequireRole
                  roles={[
                    RoleCode.QUALIFICATION,
                    RoleCode.TRAITEMENT,
                    RoleCode.AFFECTATION,
                    RoleCode.VERIFICATION,
                    RoleCode.DECISION,
                    RoleCode.ADMIN,
                  ]}
                >
                  <DashboardPage />
                </RequireRole>
              }
            />

            <Route
              path="/qualification"
              element={
                <RequireRole
                  roles={[RoleCode.QUALIFICATION, RoleCode.TRAITEMENT]}
                >
                  <QualificationPage />
                </RequireRole>
              }
            />

            <Route
              path="/interventions"
              element={
                <RequireRole
                  roles={[
                    RoleCode.QUALIFICATION,
                    RoleCode.AFFECTATION,
                    RoleCode.TRAITEMENT,
                    RoleCode.VERIFICATION,
                    RoleCode.DECISION,
                    RoleCode.ADMIN,
                  ]}
                >
                  <DashboardPage initialFilter="INTERVENTION" />
                </RequireRole>
              }
            />

            <Route
              path="/dossiers"
              element={
                <RequireRole
                  roles={[RoleCode.TRAITEMENT, RoleCode.AFFECTATION]}
                >
                  <DossiersPage />
                </RequireRole>
              }
            />

            <Route
              path="/affectations"
              element={
                <RequireRole roles={[RoleCode.AFFECTATION]}>
                  <AffectationsPage />
                </RequireRole>
              }
            />

            <Route
              path="/verifications"
              element={
                <RequireRole roles={[RoleCode.VERIFICATION]}>
                  <VerificationsPage />
                </RequireRole>
              }
            />

            <Route
              path="/carte"
              element={
                <RequireRole
                  roles={[
                    RoleCode.DECISION,
                    RoleCode.QUALIFICATION,
                    RoleCode.TRAITEMENT,
                    RoleCode.AFFECTATION,
                    RoleCode.VERIFICATION,
                    RoleCode.ADMIN,
                  ]}
                >
                  <CarteDakarPage />
                </RequireRole>
              }
            />

            <Route
              path="/statistiques"
              element={
                <RequireRole
                  roles={[RoleCode.DECISION, RoleCode.TRAITEMENT, RoleCode.ADMIN]}
                >
                  <StatistiquesPage />
                </RequireRole>
              }
            />

            <Route
              path="/audit"
              element={
                <RequireRole
                  roles={[
                    RoleCode.ADMIN,
                    RoleCode.QUALIFICATION,
                    RoleCode.TRAITEMENT,
                    RoleCode.AFFECTATION,
                    RoleCode.VERIFICATION,
                    RoleCode.DECISION,
                  ]}
                >
                  <AuditPage />
                </RequireRole>
              }
            />

            <Route
              path="/admin"
              element={
                <RequireRole roles={[RoleCode.ADMIN]}>
                  <AdminComptesPage />
                </RequireRole>
              }
            />

            <Route
              path="/referentiels"
              element={
                <RequireRole roles={[RoleCode.ADMIN]}>
                  <ReferentielsPage />
                </RequireRole>
              }
            />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};
