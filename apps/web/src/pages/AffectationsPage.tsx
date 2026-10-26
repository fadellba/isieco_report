import React, { useState, useEffect } from 'react';
import type { ApiListResponse, AffectationEnAttente, CompetenceEquipeItem } from '@isieco/shared';
import { api } from '../api/client.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { ReasonModal } from '../components/ui/ReasonModal.js';
import {
  GitFork,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  ArrowRight,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

export const AffectationsPage: React.FC = () => {
  const [voletsEnAttente, setVoletsEnAttente] = useState<AffectationEnAttente[]>([]);
  const [competences, setCompetences] = useState<CompetenceEquipeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedVolet, setSelectedVolet] = useState<AffectationEnAttente | null>(null);
  const [selectedCompetenceId, setSelectedCompetenceId] = useState('');
  const [motif, setMotif] = useState('');
  const [observation, setObservation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [voletsRes, compRes] = await Promise.all([
        api.get<ApiListResponse<AffectationEnAttente>>('/affectations/en-attente'),
        api.get<ApiListResponse<CompetenceEquipeItem>>('/referentiels/competences'),
      ]);
      setVoletsEnAttente(voletsRes.data || []);
      setCompetences(compRes.data || []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Impossible de charger les données d’affectation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtrer les compétences actives valides pour le type de déchet du volet sélectionné (Règle T06 / T07)
  const availableCompetences = selectedVolet
    ? competences.filter((c) => c.idTypeDechet === selectedVolet.idTypeDechet)
    : [];

  const handleAffecter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVolet || !selectedCompetenceId) return;

    const chosenComp = availableCompetences.find(
      (c) => c.idCompetenceEquipe === selectedCompetenceId
    );
    if (!chosenComp) return;

    try {
      setSubmitting(true);
      setFeedback(null);

      // Générer une clé d idempotence unique côté client (Test T16)
      const opRef = `OP-AFF-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      await api.post('/affectations', {
        idDossier: selectedVolet.idDossier,
        idTypeDechet: selectedVolet.idTypeDechet,
        idEquipe: chosenComp.idEquipe,
        idCompetenceEquipe: chosenComp.idCompetenceEquipe,
        motif: motif.trim() || 'Assignation par responsable d affectation',
        observation: observation.trim() || undefined,
        referenceOperationUnique: opRef,
      });

      setFeedback({
        type: 'success',
        message: `Volet "${selectedVolet.libelleDechet}" affecté avec succès à "${chosenComp.nomEquipe}".`,
      });
      setSelectedVolet(null);
      setSelectedCompetenceId('');
      setMotif('');
      setObservation('');
      await fetchData();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Erreur lors de l affectation du volet.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ops-workflow-page p-6 space-y-6">
      {/* Title */}
      <div className="ops-workflow-heading flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-isieco-dark flex items-center gap-2">
            <GitFork className="h-6 w-6 text-isieco-primary" />
            Affectations Spécialisées par Volet Technique
          </h2>
          <p className="text-xs text-isieco-muted mt-0.5">
            Assignation chirurgicale de chaque catégorie de déchet sous contrôle strict de concordance de compétences actives.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-isieco-border bg-white px-3 py-1.5 text-xs font-semibold text-isieco-dark shadow-sm hover:bg-gray-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      <div className="ops-workflow-metrics" aria-label="Aperçu des affectations">
        <article className="ops-workflow-metric">
          <span>Volets à affecter</span>
          <strong>{loading ? '—' : voletsEnAttente.length}</strong>
          <small>En attente d’une équipe</small>
        </article>
        <article className="ops-workflow-metric">
          <span>Équipes correspondantes</span>
          <strong>{selectedVolet ? availableCompetences.length : '—'}</strong>
          <small>{selectedVolet ? selectedVolet.libelleDechet : 'Sélectionnez un volet'}</small>
        </article>
        <article className="ops-workflow-metric">
          <span>Compétences actives</span>
          <strong>{loading ? '—' : competences.length}</strong>
          <small>Référentiel des équipes</small>
        </article>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700" role="alert">
          <span>Erreur de chargement : {loadError}</span>
          <button type="button" onClick={() => void fetchData()} className="font-semibold underline">
            Réessayer
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-xl p-4 text-xs border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Workspace */}
      <div className="ops-workflow-grid grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        
        {/* Left Column : Volets en attente (6 cols) */}
        <div className="ops-workflow-panel lg:col-span-6 rounded-xl border border-isieco-border bg-white shadow-sm flex flex-col">
          <div className="border-b border-isieco-border p-3.5 bg-gray-50/70 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-isieco-dark">
              Volets en attente d affectation ({voletsEnAttente.length})
            </span>
          </div>

          <div className="divide-y divide-isieco-border overflow-y-auto max-h-[650px] flex-1">
            {voletsEnAttente.length === 0 ? (
              <div className="p-8 text-center text-xs text-isieco-muted">
                {loading
                  ? 'Chargement des volets en attente…'
                  : loadError
                    ? 'Les volets n’ont pas pu être chargés.'
                  : 'Aucun volet technique en attente d affectation. Tous les dossiers sont pourvus.'}
              </div>
            ) : (
              voletsEnAttente.map((v) => {
                const isSelected =
                  selectedVolet?.idDossier === v.idDossier &&
                  selectedVolet?.idTypeDechet === v.idTypeDechet;

                return (
                  <div
                    key={`${v.idDossier}-${v.idTypeDechet}`}
                    onClick={() => {
                      setSelectedVolet(v);
                      setSelectedCompetenceId('');
                    }}
                    className={`p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-50/70 border-l-4 border-isieco-primary'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-bold text-xs text-isieco-dark font-mono">
                        {v.referenceDossier}
                      </span>
                      <StatusBadge status={v.priorite} size="sm" />
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="rounded bg-emerald-100 text-emerald-900 px-2 py-0.5 text-xs font-bold">
                        {v.libelleDechet}
                      </span>
                      <span className="text-xs text-isieco-muted font-mono">
                        ({v.codeType})
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-isieco-muted">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Dossier créé le {new Date(v.dateCreationDossier).toLocaleDateString('fr-SN')}
                      </span>
                      <span className="text-isieco-primary font-semibold flex items-center gap-1">
                        Affecter →
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column : Formulaire d affectation contrôlée (6 cols) */}
        <div className="ops-workflow-detail lg:col-span-6">
          {selectedVolet ? (
            <div className="ops-workflow-panel rounded-xl border border-isieco-border bg-white p-6 shadow-sm space-y-5">
              <div className="border-b border-isieco-border pb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-isieco-primary">
                  Attribution de mission
                </span>
                <h3 className="text-base font-bold text-isieco-dark mt-0.5">
                  Affecter le volet : {selectedVolet.libelleDechet}
                </h3>
                <p className="text-xs text-isieco-muted mt-1">
                  Dossier : <strong className="font-mono text-gray-800">{selectedVolet.referenceDossier}</strong> • Priorité : {selectedVolet.priorite}
                </p>
              </div>

              <form onSubmit={handleAffecter} className="space-y-4 text-xs">
                {/* Sélecteur d équipes compétentes */}
                <div>
                  <label className="block font-semibold text-isieco-dark mb-1.5">
                    Équipes qualifiées & disponibles pour {selectedVolet.libelleDechet} <span className="text-rose-500">*</span>
                  </label>

                  {availableCompetences.length === 0 ? (
                    <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>Aucune équipe ne possède actuellement de compétence active pour ce type de déchet.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableCompetences.map((c) => (
                        <label
                          key={c.idCompetenceEquipe}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedCompetenceId === c.idCompetenceEquipe
                              ? 'bg-emerald-50 border-isieco-primary shadow-sm'
                              : 'border-isieco-border hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="competence"
                            value={c.idCompetenceEquipe}
                            checked={selectedCompetenceId === c.idCompetenceEquipe}
                            onChange={(e) => setSelectedCompetenceId(e.target.value)}
                            className="mt-0.5 text-isieco-primary focus:ring-isieco-primary"
                          />
                          <div>
                            <div className="font-bold text-isieco-dark text-xs">{c.nomEquipe}</div>
                            <div className="text-[11px] text-isieco-muted mt-0.5 flex items-center gap-1.5">
                              <ShieldCheck className="h-3 w-3 text-emerald-600" />
                              Compétence certifiée valide depuis le {new Date(c.dateDebut).toLocaleDateString('fr-SN')}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Motif d affectation */}
                <div>
                  <label className="block font-semibold text-isieco-dark mb-1">
                    Motif d affectation ou instructions spécifiques
                  </label>
                  <textarea
                    rows={2}
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    placeholder="Ex: Équipe la plus proche géographiquement du secteur Kermel..."
                    className="w-full rounded-lg border border-isieco-border p-2.5 focus:border-isieco-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-isieco-dark mb-1">
                    Observations pour l équipe terrain
                  </label>
                  <input
                    type="text"
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    placeholder="Ex: Accès par la rue latérale, prévoir benne 10m3..."
                    className="w-full rounded-lg border border-isieco-border p-2.5 focus:border-isieco-primary focus:outline-none"
                  />
                </div>

                <div className="pt-3 border-t border-isieco-border flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedVolet(null)}
                    className="rounded-lg border border-isieco-border px-4 py-2 text-xs font-semibold hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedCompetenceId || submitting}
                    className="flex items-center gap-1.5 rounded-lg bg-isieco-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-isieco-primary-dark transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {submitting ? 'Affectation...' : 'Valider l Affectation'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="ops-workflow-panel rounded-xl border border-dashed border-isieco-border p-12 text-center text-xs text-isieco-muted bg-white flex flex-col items-center justify-center min-h-[400px]">
              <GitFork className="h-8 w-8 text-gray-300 mb-2" />
              {loading
                ? 'Chargement des volets et des équipes…'
                : loadError
                  ? 'Les informations d’affectation ne sont pas disponibles.'
                : 'Sélectionnez un volet en attente dans la liste de gauche pour affecter une équipe compétente.'}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
