import React, { useState, useEffect } from 'react';
import type {
  ApiListResponse,
  CompetenceEquipeItem,
  EquipeReferentiel,
  TypeDechetItem,
} from '@isieco/shared';
import { api } from '../api/client.js';
import {
  BookOpen,
  Users,
  Award,
  Plus,
  Calendar,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Clock,
  Layers,
  ShieldCheck,
} from 'lucide-react';

export const ReferentielsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dechets' | 'equipes' | 'competences'>('dechets');
  const [typesDechets, setTypesDechets] = useState<TypeDechetItem[]>([]);
  const [equipes, setEquipes] = useState<EquipeReferentiel[]>([]);
  const [competences, setCompetences] = useState<CompetenceEquipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal d'ajout de compétence d'équipe (Test T22)
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEquipeId, setSelectedEquipeId] = useState('');
  const [selectedTypeDechetId, setSelectedTypeDechetId] = useState('');
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().split('T')[0]);
  const [dateFin, setDateFin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dechetsRes, equipesRes, compRes] = await Promise.all([
        api.get<ApiListResponse<TypeDechetItem>>('/referentiels/types-dechets'),
        api.get<ApiListResponse<EquipeReferentiel>>('/referentiels/equipes'),
        api.get<ApiListResponse<CompetenceEquipeItem>>('/referentiels/competences'),
      ]);
      setTypesDechets(dechetsRes.data || []);
      setEquipes(equipesRes.data || []);
      setCompetences(compRes.data || []);
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Erreur lors du chargement des référentiels.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddCompetence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipeId || !selectedTypeDechetId || !dateDebut) {
      setModalError('L équipe, la catégorie de déchet et la date d effet sont requises.');
      return;
    }

    // Contrôle Règle T22 : dateFin >= dateDebut si fournie
    if (dateFin && new Date(dateFin) < new Date(dateDebut)) {
      setModalError('La date de fin ne peut pas être antérieure à la date de début (Règle T22).');
      return;
    }

    try {
      setSubmitting(true);
      setModalError(null);
      await api.post('/referentiels/competences', {
        idEquipe: selectedEquipeId,
        idTypeDechet: selectedTypeDechetId,
        dateDebut,
        dateFin: dateFin || null,
      });

      setFeedback({ type: 'success', message: 'Nouvelle habilitation / compétence enregistrée avec succès.' });
      setModalOpen(false);
      setSelectedEquipeId('');
      setSelectedTypeDechetId('');
      setDateFin('');
      await fetchData();
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'Erreur lors de l enregistrement de la compétence.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-isieco-dark flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-isieco-primary" />
            Référentiels Opérationnels & Habilitations
          </h2>
          <p className="text-xs text-isieco-muted mt-0.5">
            Gestion des catégories de déchets, des équipes communales de Dakar et des compétences d intervention certifiées.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-isieco-border bg-white px-3 py-2 text-xs font-semibold text-isieco-dark shadow-sm hover:bg-gray-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-isieco-primary px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-isieco-primary-dark transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nouvelle Habilitation
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl text-xs font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-[11px] underline">
            Fermer
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-isieco-border gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('dechets')}
          className={`pb-3 flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'dechets'
              ? 'border-isieco-primary text-isieco-primary'
              : 'border-transparent text-isieco-muted hover:text-isieco-dark'
          }`}
        >
          <Layers className="h-4 w-4" />
          Catégories de Déchets ({typesDechets.length})
        </button>
        <button
          onClick={() => setActiveTab('equipes')}
          className={`pb-3 flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'equipes'
              ? 'border-isieco-primary text-isieco-primary'
              : 'border-transparent text-isieco-muted hover:text-isieco-dark'
          }`}
        >
          <Users className="h-4 w-4" />
          Équipes de Salubrité ({equipes.length})
        </button>
        <button
          onClick={() => setActiveTab('competences')}
          className={`pb-3 flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'competences'
              ? 'border-isieco-primary text-isieco-primary'
              : 'border-transparent text-isieco-muted hover:text-isieco-dark'
          }`}
        >
          <Award className="h-4 w-4" />
          Habilitations Actives ({competences.length})
        </button>
      </div>

      {/* Tab 1: Types de Déchets */}
      {activeTab === 'dechets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {typesDechets.map((t) => (
            <div
              key={t.idTypeDechet}
              className="rounded-xl border border-isieco-border bg-white p-4 shadow-sm hover:shadow-md transition-shadow space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-isieco-primary border border-emerald-200 font-mono">
                  {t.codeType}
                </span>
                <span className="text-[10px] text-isieco-muted">
                  Depuis le {new Date(t.dateDebutValidite).toLocaleDateString('fr-SN')}
                </span>
              </div>
              <h3 className="text-sm font-bold text-isieco-dark">{t.libelle}</h3>
              <p className="text-xs text-isieco-muted leading-relaxed line-clamp-3">
                {t.description || 'Aucune description spécifique renseignée.'}
              </p>
              {t.orientationSpecialisee && (
                <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-purple-700 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Orientation spécialisée / filière dédiée
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Équipes de Salubrité */}
      {activeTab === 'equipes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {equipes.map((eq) => (
            <div
              key={eq.idEquipe}
              className="rounded-xl border border-isieco-border bg-white p-5 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between border-b border-isieco-border pb-3">
                <div>
                  <h3 className="text-sm font-black text-isieco-dark">{eq.nomEquipe}</h3>
                  <p className="text-xs text-isieco-muted">{eq.description || 'Équipe municipale de Dakar'}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  {eq.etatEquipe}
                </span>
              </div>

              {/* Membres actifs */}
              <div>
                <h4 className="text-[11px] font-bold text-isieco-muted uppercase tracking-wider mb-2">
                  Agents Membres ({eq.membres?.length || 0})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {eq.membres.map((m) => (
                    <span
                      key={m.idUtilisateur}
                      className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs text-slate-700 font-medium"
                    >
                      {m.prenom} {m.nom} {m.fonction ? `• ${m.fonction}` : ''}
                    </span>
                  ))}
                  {(!eq.membres || eq.membres.length === 0) && (
                    <span className="text-xs text-isieco-muted italic">Aucun agent assigné</span>
                  )}
                </div>
              </div>

              {/* Compétences certifiées */}
              <div>
                <h4 className="text-[11px] font-bold text-isieco-muted uppercase tracking-wider mb-2">
                  Filières & Catégories Habilitées ({eq.competences?.length || 0})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {eq.competences.map((c) => (
                    <span
                      key={c.idCompetenceEquipe}
                      className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs text-emerald-800 font-semibold"
                    >
                      {c.libelleDechet} ({c.codeType})
                    </span>
                  ))}
                  {(!eq.competences || eq.competences.length === 0) && (
                    <span className="text-xs text-amber-700 bg-amber-50 p-2 rounded block">
                      ⚠ Aucune compétence active enregistrée pour cette équipe.
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Table des Habilitations */}
      {activeTab === 'competences' && (
        <div className="rounded-xl border border-isieco-border bg-white shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-isieco-border text-[11px] font-bold text-isieco-muted uppercase">
              <tr>
                <th className="px-4 py-3">Équipe de Salubrité</th>
                <th className="px-4 py-3">Catégorie de Déchet</th>
                <th className="px-4 py-3">Date de Début</th>
                <th className="px-4 py-3">Date d Expiration</th>
                <th className="px-4 py-3">Statut Validité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-isieco-border">
              {competences.map((c) => {
                const now = new Date();
                const isExpired = c.dateFin && new Date(c.dateFin) < now;
                const isFuture = new Date(c.dateDebut) > now;
                const isActive = !isExpired && !isFuture;

                return (
                  <tr key={c.idCompetenceEquipe} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-bold text-isieco-dark">{c.nomEquipe}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-800">{c.libelleDechet}</span>
                      <span className="ml-1.5 text-[10px] font-mono text-isieco-muted">({c.codeType})</span>
                    </td>
                    <td className="px-4 py-3 text-isieco-muted">
                      {new Date(c.dateDebut).toLocaleDateString('fr-SN')}
                    </td>
                    <td className="px-4 py-3 text-isieco-muted">
                      {c.dateFin ? new Date(c.dateFin).toLocaleDateString('fr-SN') : 'Indéterminée (Active)'}
                    </td>
                    <td className="px-4 py-3">
                      {isActive && (
                        <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                          Active & Habilitée
                        </span>
                      )}
                      {isExpired && (
                        <span className="rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[10px] font-bold">
                          Expirée (Non Affectable)
                        </span>
                      )}
                      {isFuture && (
                        <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold">
                          À Venir
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Ajout Compétence */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-isieco-border space-y-4">
            <div className="flex items-center justify-between border-b border-isieco-border pb-3">
              <h3 className="text-base font-bold text-isieco-dark flex items-center gap-2">
                <Award className="h-5 w-5 text-isieco-primary" />
                Attribuer une Habilitation d Équipe (RG23-RG26)
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddCompetence} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-isieco-dark mb-1">
                  Équipe Municipale Cible
                </label>
                <select
                  value={selectedEquipeId}
                  onChange={(e) => setSelectedEquipeId(e.target.value)}
                  className="w-full rounded-lg border border-isieco-border p-2.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-isieco-primary/20"
                  required
                >
                  <option value="">Sélectionnez une équipe...</option>
                  {equipes.map((eq) => (
                    <option key={eq.idEquipe} value={eq.idEquipe}>
                      {eq.nomEquipe}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-isieco-dark mb-1">
                  Catégorie de Déchet Habilitée
                </label>
                <select
                  value={selectedTypeDechetId}
                  onChange={(e) => setSelectedTypeDechetId(e.target.value)}
                  className="w-full rounded-lg border border-isieco-border p-2.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-isieco-primary/20"
                  required
                >
                  <option value="">Sélectionnez un type de déchet...</option>
                  {typesDechets.map((t) => (
                    <option key={t.idTypeDechet} value={t.idTypeDechet}>
                      {t.libelle} ({t.codeType})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-isieco-dark mb-1">
                    Date d Effet (Début)
                  </label>
                  <input
                    type="date"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    className="w-full rounded-lg border border-isieco-border p-2 text-xs bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-isieco-dark mb-1">
                    Date d Expiration (Optionnel)
                  </label>
                  <input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    className="w-full rounded-lg border border-isieco-border p-2 text-xs bg-white"
                  />
                </div>
              </div>

              <div className="text-[11px] text-isieco-muted bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
                ℹ️ <strong>Règle d intégrité T22 :</strong> La date de fin doit être postérieure ou égale à la date de début. Une compétence expirée interdira automatiquement l affectation de l équipe pour ce type de déchet (Règles T06 & T07).
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-isieco-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-isieco-muted hover:text-isieco-dark"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-isieco-primary text-white text-xs font-semibold hover:bg-isieco-primary-dark transition shadow-sm"
                >
                  {submitting ? 'Enregistrement...' : 'Valider l Habilitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
