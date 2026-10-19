import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';
import { RoleCode } from '@isieco/shared';
import {
  Users,
  ShieldAlert,
  UserCheck,
  UserX,
  PlusCircle,
  RefreshCw,
  Search,
  KeyRound,
  Shield,
} from 'lucide-react';
import { ReasonModal } from '../components/ui/ReasonModal.js';

interface UserRecord {
  idUtilisateur: string;
  nom: string;
  prenom: string | null;
  email: string;
  telephone: string | null;
  etatCompte: string;
  dateInscription: string;
  roles: string[];
}

const ALL_ROLES = [
  { code: RoleCode.QUALIFICATION, label: 'Gestionnaire Qualification' },
  { code: RoleCode.TRAITEMENT, label: 'Gestionnaire Traitement' },
  { code: RoleCode.AFFECTATION, label: 'Responsable Affectation' },
  { code: RoleCode.TERRAIN, label: 'Agent de Terrain' },
  { code: RoleCode.VERIFICATION, label: 'Agent Vérification' },
  { code: RoleCode.DECISION, label: 'Autorité Décisionnelle' },
  { code: RoleCode.ADMIN, label: 'Administrateur Système' },
  { code: RoleCode.CITOYEN, label: 'Citoyen' },
];

export const AdminComptesPage: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Status Change State
  const [statusUser, setStatusUser] = useState<UserRecord | null>(null);
  const [newStatus, setNewStatus] = useState<string>('INACTIF');

  // Role Add State
  const [roleUser, setRoleUser] = useState<UserRecord | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>(RoleCode.QUALIFICATION);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: UserRecord[] }>(
        '/api/utilisateurs'
      );
      setUsers(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des comptes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateStatus = async (motif: string) => {
    if (!statusUser) return;
    try {
      await apiClient.patch(`/api/utilisateurs/${statusUser.idUtilisateur}/etat`, {
        etatCompte: newStatus,
        motif,
      });
      setStatusUser(null);
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la modification du statut');
    }
  };

  const handleAssignRole = async (motif: string) => {
    if (!roleUser) return;
    try {
      await apiClient.post(`/api/utilisateurs/${roleUser.idUtilisateur}/roles`, {
        codeRole: selectedRole,
        motif,
      });
      setRoleUser(null);
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'attribution du rôle");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.prenom && u.prenom.toLowerCase().includes(searchTerm.toLowerCase())) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-isieco-dark tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-isieco-primary" />
            Administration des Utilisateurs & Rôles RBAC
          </h1>
          <p className="text-sm text-isieco-muted mt-0.5">
            Gestion fine des privilèges du personnel communal et révocation immédiate de session (RG08 / Test T39)
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-isieco-primary' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">Total Comptes</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{users.length}</div>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">Comptes Actifs</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {users.filter((u) => u.etatCompte === 'ACTIF').length}
            </div>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400">Suspendus / Inactifs</span>
            <div className="text-2xl font-black text-red-600 mt-1">
              {users.filter((u) => u.etatCompte !== 'ACTIF').length}
            </div>
          </div>
          <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
            <UserX className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher par nom, prénom ou email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Utilisateur</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Statut Compte</th>
                <th className="py-3 px-4">Rôles Attribués</th>
                <th className="py-3 px-4">Inscription</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isActive = u.etatCompte === 'ACTIF';
                  return (
                    <tr key={u.idUtilisateur} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {u.prenom} {u.nom}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          UUID: {u.idUtilisateur.substring(0, 8)}...
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{u.email}</div>
                        <div className="text-[11px] text-slate-400">{u.telephone || 'N/A'}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {isActive ? (
                            <UserCheck className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <UserX className="h-3 w-3 text-red-600" />
                          )}
                          {u.etatCompte}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {u.roles.map((r) => (
                            <span
                              key={r}
                              className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-700 border border-slate-200 font-semibold"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                        {new Date(u.dateInscription).toLocaleDateString('fr-SN')}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Role Assign button */}
                          <button
                            onClick={() => {
                              setRoleUser(u);
                              setSelectedRole(RoleCode.QUALIFICATION);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition text-[11px] font-semibold"
                            title="Attribuer un rôle supplémentaire"
                          >
                            <Shield className="h-3 w-3 text-slate-500" />
                            + Rôle
                          </button>

                          {/* Toggle Active / Inactive */}
                          {isActive ? (
                            <button
                              onClick={() => {
                                setStatusUser(u);
                                setNewStatus('INACTIF');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition text-[11px] font-semibold"
                              title="Désactiver le compte et révoquer ses sessions (T39)"
                            >
                              <UserX className="h-3 w-3" />
                              Désactiver
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setStatusUser(u);
                                setNewStatus('ACTIF');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition text-[11px] font-semibold"
                            >
                              <UserCheck className="h-3 w-3" />
                              Réactiver
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Changement Statut */}
      <ReasonModal
        isOpen={Boolean(statusUser)}
        title={`Passer le compte de ${statusUser?.prenom} ${statusUser?.nom} en ${newStatus}`}
        confirmLabel={newStatus === 'INACTIF' ? 'Désactiver & Révoquer Sessions' : 'Réactiver'}
        placeholder="Justification administrative obligatoire (ex: Départ agent, fin de mission)..."
        minChars={5}
        onClose={() => setStatusUser(null)}
        onConfirm={handleUpdateStatus}
      />

      {/* Modal Attribution Rôle */}
      {roleUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Attribuer un rôle à {roleUser.prenom} {roleUser.nom}
              </h3>
              <button
                onClick={() => setRoleUser(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Sélectionner le rôle opérationnel
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label} ({r.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Motif d'attribution (optionnel)
              </label>
              <textarea
                id="role-motif-input"
                placeholder="Ex: Habilitation pour la cellule Dakar-Plateau..."
                rows={2}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setRoleUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  const val = (document.getElementById('role-motif-input') as HTMLTextAreaElement)?.value || '';
                  handleAssignRole(val);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-isieco-primary hover:bg-emerald-700 transition shadow-sm"
              >
                Confirmer l'attribution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

