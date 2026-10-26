import React, { useState, useEffect } from 'react';
import type { ApiDataResponse, ApiListResponse, DossierDetail, DossierListItem } from '@isieco/shared';
import { api } from '../api/client.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { ReasonModal } from '../components/ui/ReasonModal.js';
import {
  CheckCircle2,
  XCircle,
  FolderLock,
  RotateCcw,
  AlertTriangle,
  RefreshCw,
  Camera,
  Layers,
  FileCheck,
} from 'lucide-react';

export const VerificationsPage: React.FC = () => {
  const [dossiers, setDossiers] = useState<DossierListItem[]>([]);
  const [selectedDossier, setSelectedDossier] = useState<DossierDetail | null>(null);
  const [detailDossierId, setDetailDossierId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modale de réouverture (Test T15 / T36)
  const [reouvrirModalOpen, setReouvrirModalOpen] = useState(false);
  const [dossierToReopen, setDossierToReopen] = useState<string | null>(null);
  const [nonConformiteModalOpen, setNonConformiteModalOpen] = useState(false);
  const [affectationToReject, setAffectationToReject] = useState<string | null>(null);

  const fetchDossiers = async (): Promise<boolean> => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get<ApiListResponse<DossierListItem>>('/dossiers');
      setDossiers(res.data || []);
      if (res.data && res.data.length > 0 && !selectedDossier) {
        await loadDossierDetail(res.data[0].idDossier);
      } else if (res.data.length === 0) {
        setSelectedDossier(null);
        setDetailDossierId(null);
      }
      return true;
    } catch (error) {
      setDossiers([]);
      setSelectedDossier(null);
      setDetailDossierId(null);
      setLoadError(error instanceof Error ? error.message : 'Impossible de charger les dossiers.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    const selectedDossierId = selectedDossier?.id_dossier;
    if (!(await fetchDossiers()) || !selectedDossierId) return;

    try {
      const res = await api.get<ApiDataResponse<DossierDetail>>(`/dossiers/${selectedDossierId}`);
      setSelectedDossier(res.data);
    } catch (error) {
      setSelectedDossier(null);
      setLoadError(error instanceof Error ? error.message : 'Impossible de charger le détail du dossier.');
    }
  };

  const loadDossierDetail = async (id: string) => {
    try {
      setDetailDossierId(id);
      setLoadError(null);
      setSelectedDossier(null);
      const res = await api.get<ApiDataResponse<DossierDetail>>(`/dossiers/${id}`);
      setSelectedDossier(res.data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Impossible de charger le détail du dossier.');
    }
  };

  useEffect(() => {
    fetchDossiers();
  }, []);

  // Validation d un volet (CONFORME_RESOLU)
  const handleValiderVolet = async (idAffectation: string) => {
    if (!selectedDossier) return;
    try {
      setFeedback(null);
      await api.post('/verifications', {
        idAffectation,
        resultatVerification: 'CONFORME_RESOLU',
        motif: 'Contrôle terrain conforme : zone nettoyée et zéro résidu.',
      });
      setFeedback({ type: 'success', message: 'Volet validé conforme avec succès.' });
      await loadDossierDetail(selectedDossier.id_dossier);
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Erreur lors de la validation du volet.' });
    }
  };

  // Rejet d un volet (NON_CONFORME -> réactive l affectation)
  const handleRejeterVolet = async (motif: string) => {
    if (!selectedDossier || !affectationToReject) return;

    setFeedback(null);
    await api.post('/verifications', {
      idAffectation: affectationToReject,
      resultatVerification: 'NON_CONFORME',
      motif,
    });
    setFeedback({
      type: 'success',
      message: 'Volet marqué non-conforme. Affectation réactivée pour nouvelle intervention.',
    });
    await loadDossierDetail(selectedDossier.id_dossier);
  };

  // Clôture 100% de résolution confirmée (Test T13 / T14)
  const handleCloturerDossier = async () => {
    if (!selectedDossier) return;
    try {
      setFeedback(null);
      await api.post(`/verifications/dossiers/${selectedDossier.id_dossier}/cloturer`, {
        motif: 'Clôture complète confirmée : 100% des volets techniques résolus et vérifiés sur site.',
      });
      setFeedback({
        type: 'success',
        message: 'Dossier clôturé avec succès après vérification complète à 100%.',
      });
      await loadDossierDetail(selectedDossier.id_dossier);
      await fetchDossiers();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Impossible de clôturer le dossier.',
      });
    }
  };

  // Réouverture après clôture (Test T15 / T36)
  const handleConfirmReouverture = async (motif: string) => {
    if (!dossierToReopen) return;
    try {
      setFeedback(null);
      await api.post(`/verifications/dossiers/${dossierToReopen}/reouvrir`, { motif });
      setFeedback({
        type: 'success',
        message: 'Dossier rouvert avec succès et conservé dans l historique.',
      });
      await loadDossierDetail(dossierToReopen);
      await fetchDossiers();
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Erreur lors de la réouverture du dossier.',
      });
    }
  };

  // Calcul du taux de volets résolus (100% requis pour bouton de clôture)
  const voletsInclus = selectedDossier?.volets.filter((v) => v.etatContenuDossier === 'INCLUSE') || [];
  const totalVoletsInclus = voletsInclus.length;
  const dateReouverture = selectedDossier?.date_reouverture
    ? new Date(selectedDossier.date_reouverture).getTime()
    : null;
  const voletsTermines = voletsInclus.filter((volet) => {
    const affectationCourante = selectedDossier?.affectations.find((affectation) =>
      affectation.idTypeDechet === volet.idTypeDechet
      && (dateReouverture === null || new Date(affectation.dateAffectation).getTime() > dateReouverture)
    );
    return affectationCourante?.etatAffectation === 'TERMINEE';
  }).length;
  const is100PercentResolved = totalVoletsInclus > 0 && voletsTermines === totalVoletsInclus;
  const resolutionPercent = totalVoletsInclus > 0
    ? Math.min(100, Math.round((voletsTermines / totalVoletsInclus) * 100))
    : 0;

  return (
    <div className="ops-workflow-page p-6 space-y-6">
      {/* Title */}
      <div className="ops-workflow-heading flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-isieco-dark flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-isieco-primary" />
            Contrôle de Résolution, Clôture 100% & Réouverture
          </h2>
          <p className="text-xs text-isieco-muted mt-0.5">
            Validation indépendante par volet technique, contrôle strict d intégrité à 100% et réouverture tracée.
          </p>
        </div>
        <button
          onClick={() => void handleRefresh()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-isieco-border bg-white px-3 py-1.5 text-xs font-semibold text-isieco-dark shadow-sm hover:bg-gray-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      <div className="ops-workflow-metrics" aria-label="Aperçu des vérifications">
        <article className="ops-workflow-metric">
          <span>Dossiers à contrôler</span>
          <strong>{loading ? '—' : dossiers.length}</strong>
          <small>Disponibles dans le suivi</small>
        </article>
        <article className="ops-workflow-metric">
          <span>Volets vérifiés</span>
          <strong>{selectedDossier ? `${voletsTermines} / ${totalVoletsInclus}` : '—'}</strong>
          <small>{selectedDossier?.reference_dossier || 'Sélectionnez un dossier'}</small>
        </article>
        <article className="ops-workflow-metric">
          <span>Progression de clôture</span>
          <strong>{selectedDossier ? `${resolutionPercent}%` : '—'}</strong>
          <small>Clôture soumise à 100 %</small>
        </article>
      </div>

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
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700" role="alert">
          <span>Erreur de chargement : {loadError}</span>
          <button
            type="button"
            onClick={() => {
              if (detailDossierId) void loadDossierDetail(detailDossierId);
              else void fetchDossiers();
            }}
            className="font-semibold underline"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="ops-workflow-grid grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        {/* Left Dossiers List (4 cols) */}
        <div className="ops-workflow-panel lg:col-span-4 rounded-xl border border-isieco-border bg-white shadow-sm flex flex-col">
          <div className="border-b border-isieco-border p-3.5 bg-gray-50/70 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-isieco-dark">
              Dossiers ({dossiers.length})
            </span>
          </div>

          <div className="divide-y divide-isieco-border overflow-y-auto max-h-[650px] flex-1">
            {dossiers.length === 0 ? (
              <div className="p-8 text-center text-xs text-isieco-muted">
                {loading
                  ? 'Chargement des dossiers…'
                  : loadError
                    ? 'Les dossiers ne sont pas disponibles.'
                    : 'Aucun dossier à contrôler.'}
              </div>
            ) : dossiers.map((d) => (
              <div
                key={d.idDossier}
                onClick={() => loadDossierDetail(d.idDossier)}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedDossier?.id_dossier === d.idDossier
                    ? 'bg-emerald-50/70 border-l-4 border-isieco-primary'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-xs text-isieco-dark font-mono">
                    {d.referenceDossier}
                  </span>
                  <StatusBadge status={d.statutDossier} size="sm" />
                </div>
                <p className="text-xs text-gray-800 line-clamp-2 leading-relaxed">
                  {d.descriptionSynthese}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Verification Controls (8 cols) */}
        <div className="ops-workflow-detail lg:col-span-8">
          {selectedDossier ? (
            <div className="ops-workflow-panel rounded-xl border border-isieco-border bg-white p-6 shadow-sm space-y-6">
              {/* Header */}
              <div className="border-b border-isieco-border pb-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-isieco-dark font-mono">
                      {selectedDossier.reference_dossier}
                    </span>
                    <StatusBadge status={selectedDossier.statut_dossier} />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800 mt-1">
                    {selectedDossier.description_synthese}
                  </h3>
                </div>

                {/* Bouton de Réouverture si clos (Test T15 / T36) */}
                {['CLOS_RESOLUTION_CONFIRMEE', 'CLOS_SANS_SUITE'].includes(
                  selectedDossier.statut_dossier
                ) && (
                  <button
                    onClick={() => {
                      setDossierToReopen(selectedDossier.id_dossier);
                      setReouvrirModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Rouvrir le dossier
                  </button>
                )}
              </div>

              {/* Invariant 100% Progress Indicator */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-isieco-dark flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-isieco-primary" />
                    Invariant de Clôture (ADR-03 / Invariant 2)
                  </span>
                  <span className="font-bold text-isieco-primary">
                    {voletsTermines} / {totalVoletsInclus} volets validés conformes
                  </span>
                </div>
                <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      is100PercentResolved ? 'bg-emerald-600' : 'bg-amber-500'
                    }`}
                    style={{
                      width: `${resolutionPercent}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-isieco-muted mt-2">
                  {is100PercentResolved
                    ? '✓ 100% des volets sont positivement vérifiés. La clôture définitive peut être prononcée.'
                    : dateReouverture !== null
                      ? '⚠ Dossier rouvert : chaque volet inclus doit recevoir une nouvelle affectation et une nouvelle vérification positive avant toute re-clôture.'
                      : '⚠ Clôture bloquée : chaque catégorie de déchet doit obligatoirement faire l objet d une vérification positive.'}
                </p>
              </div>

              {/* Affectations et Volets à contrôler */}
              <div>
                <h4 className="text-xs font-bold text-isieco-dark uppercase tracking-wider mb-3">
                  Contrôle des Missions & Interventions Terrain
                </h4>

                <div className="space-y-3">
                  {selectedDossier.affectations?.length === 0 ? (
                    <div className="p-4 text-center text-xs text-isieco-muted bg-gray-50 rounded-lg">
                      Aucune affectation active pour ce dossier.
                    </div>
                  ) : (
                    selectedDossier.affectations.map((aff) => (
                      <div
                        key={aff.idAffectation}
                        className="rounded-xl border border-isieco-border p-4 bg-white shadow-sm flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-isieco-dark">
                              Volet : {aff.codeType}
                            </span>
                            <StatusBadge status={aff.etatAffectation} size="sm" />
                          </div>
                          <div className="text-xs text-isieco-muted mt-1">
                            Équipe assignée : <strong className="text-gray-800">{aff.nomEquipe}</strong> • Affecté le :{' '}
                            {new Date(aff.dateAffectation).toLocaleDateString('fr-SN')}
                          </div>
                        </div>

                        {selectedDossier.statut_dossier !== 'CLOS_RESOLUTION_CONFIRMEE' &&
                        aff.etatAffectation === 'A_VERIFIER' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setAffectationToReject(aff.idAffectation);
                                setNonConformiteModalOpen(true);
                              }}
                              className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Non Conforme
                            </button>
                            <button
                              onClick={() => handleValiderVolet(aff.idAffectation)}
                              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Valider Résolu
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-isieco-muted" role="status">
                            {aff.etatAffectation === 'ACTIVE'
                              ? 'En attente du compte-rendu de l’équipe terrain.'
                              : aff.etatAffectation === 'TERMINEE'
                                ? 'Vérification déjà effectuée pour ce volet.'
                                : 'Aucune action de vérification disponible.'}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Bouton de Clôture Globale (Test T13 / T14) */}
              {selectedDossier.statut_dossier !== 'CLOS_RESOLUTION_CONFIRMEE' && (
                <div className="pt-4 border-t border-isieco-border flex justify-end">
                  <button
                    onClick={handleCloturerDossier}
                    disabled={!is100PercentResolved}
                    className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all ${
                      is100PercentResolved
                        ? 'bg-isieco-primary hover:bg-isieco-primary-dark cursor-pointer'
                        : 'bg-gray-300 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <FolderLock className="h-4 w-4" />
                    Prononcer la Clôture Définitive (Résolution 100%)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-isieco-border p-12 text-center text-xs text-isieco-muted bg-white flex flex-col items-center justify-center min-h-[400px]">
              {loading || (detailDossierId && !loadError)
                ? 'Chargement du dossier sélectionné…'
                : 'Sélectionnez un dossier à gauche pour examiner ses interventions terrain et valider la clôture.'}
            </div>
          )}
        </div>
      </div>

      {/* Reouverture Modal (Test T15 / T36) */}
      <ReasonModal
        isOpen={reouvrirModalOpen}
        title="Réouverture d un Dossier Préalablement Clos"
        description="La réouverture d un dossier clôturé le repasse à l état A_QUALIFIER sans supprimer les affectations et vérifications passées. Spécifiez un motif explicite d au moins 10 caractères."
        placeholder="Ex: Réapparition d un dépôt de déchets sur la même parcelle 48h après nettoyage..."
        confirmLabel="Confirmer la réouverture"
        isDestructive={false}
        onConfirm={handleConfirmReouverture}
        onClose={() => setReouvrirModalOpen(false)}
      />
      <ReasonModal
        isOpen={nonConformiteModalOpen}
        title="Signaler une non-conformité"
        description="Décrivez les résidus ou le problème constaté. Une reprise sera programmée pour ce volet."
        placeholder="Ex. Des déchets restent sur le site ; une nouvelle intervention est nécessaire."
        confirmLabel="Confirmer la non-conformité"
        minChars={5}
        isDestructive
        onConfirm={handleRejeterVolet}
        onClose={() => {
          setNonConformiteModalOpen(false);
          setAffectationToReject(null);
        }}
      />
    </div>
  );
};
