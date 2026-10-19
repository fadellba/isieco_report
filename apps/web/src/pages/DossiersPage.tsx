import React, { useState, useEffect } from 'react';
import type {
  ApiDataResponse,
  ApiListResponse,
  DossierDetail,
  DossierListItem,
  TypeDechetItem,
} from '@isieco/shared';
import { api } from '../api/client.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { ReasonModal } from '../components/ui/ReasonModal.js';
import {
  FolderKanban,
  Plus,
  ArrowRightLeft,
  Share2,
  Trash2,
  Layers,
  Calendar,
  AlertCircle,
  FileText,
} from 'lucide-react';

export const DossiersPage: React.FC = () => {
  const [dossiers, setDossiers] = useState<DossierListItem[]>([]);
  const [typesDechets, setTypesDechets] = useState<TypeDechetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDossier, setSelectedDossier] = useState<DossierDetail | null>(null);
  const [detailDossierId, setDetailDossierId] = useState<string | null>(null);
  const [dossiersError, setDossiersError] = useState<string | null>(null);
  const [typesError, setTypesError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Modale de création de dossier
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [refDossier, setRefDossier] = useState('');
  const [description, setDescription] = useState('');
  const [priorite, setPriorite] = useState('MOYENNE');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  // Modale de retrait de volet
  const [retirerModalOpen, setRetirerModalOpen] = useState(false);
  const [voletToRetirer, setVoletToRetirer] = useState<string | null>(null);

  // Modale de transfert externe (Test T27)
  const [transfertModalOpen, setTransfertModalOpen] = useState(false);
  const [destinataireExterne, setDestinataireExterne] = useState('');

  // Modale de réorientation de rattachement (Test T04)
  const [reorienterModalOpen, setReorienterModalOpen] = useState(false);
  const [signalementToReorient, setSignalementToReorient] = useState<string | null>(null);
  const [cibleDossierId, setCibleDossierId] = useState('');

  const fetchDossiers = async () => {
    try {
      setLoading(true);
      setDossiersError(null);
      const res = await api.get<ApiListResponse<DossierListItem>>('/dossiers');
      setDossiers(res.data || []);
      if (res.data && res.data.length > 0 && !selectedDossier) {
        await loadDossierDetail(res.data[0].idDossier);
      } else if (res.data.length === 0) {
        setSelectedDossier(null);
      }
    } catch (error) {
      setDossiers([]);
      setSelectedDossier(null);
      setDetailDossierId(null);
      setDossiersError(error instanceof Error ? error.message : 'Impossible de charger les dossiers.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTypesDechets = async () => {
    try {
      const res = await api.get<ApiListResponse<TypeDechetItem>>('/referentiels/types-dechets');
      setTypesDechets(res.data || []);
      setTypesError(null);
    } catch (error) {
      setTypesError(error instanceof Error ? error.message : 'Impossible de charger les catégories de déchets.');
    }
  };

  const loadDossierDetail = async (id: string) => {
    try {
      setDetailDossierId(id);
      setDetailError(null);
      setSelectedDossier(null);
      const res = await api.get<ApiDataResponse<DossierDetail>>(`/dossiers/${id}`);
      setSelectedDossier(res.data);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Impossible de charger le détail du dossier.');
    }
  };

  useEffect(() => {
    fetchDossiers();
    fetchTypesDechets();
  }, []);

  const handleCreateDossier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || selectedCategories.length === 0) {
      setCreateError('Une description de synthèse et au moins une catégorie sont requises.');
      return;
    }

    try {
      setCreateError(null);
      await api.post('/dossiers', {
        referenceDossier: refDossier.trim() || undefined,
        descriptionSynthese: description.trim(),
        priorite,
        categories: selectedCategories.map((idTypeDechet) => ({ idTypeDechet })),
      });
      setCreateModalOpen(false);
      setDescription('');
      setSelectedCategories([]);
      await fetchDossiers();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Erreur lors de la création du dossier.');
    }
  };

  const handleConfirmRetirerVolet = async (motif: string) => {
    if (!selectedDossier || !voletToRetirer) return;
    await api.post(`/dossiers/${selectedDossier.id_dossier}/categories/${voletToRetirer}/retirer`, {
      motif,
    });
    setVoletToRetirer(null);
    await loadDossierDetail(selectedDossier.id_dossier);
    await fetchDossiers();
  };

  const handleConfirmTransfert = async (motif: string) => {
    if (!selectedDossier || !destinataireExterne.trim()) return;
    await api.post(`/dossiers/${selectedDossier.id_dossier}/transfert-externe`, {
      destinataireExterne: destinataireExterne.trim(),
      motif,
    });
    setDestinataireExterne('');
    setTransfertModalOpen(false);
    await loadDossierDetail(selectedDossier.id_dossier);
    await fetchDossiers();
  };

  const handleConfirmReorienter = async (motif: string) => {
    if (!selectedDossier || !signalementToReorient || !cibleDossierId) return;
    await api.post(`/dossiers/${selectedDossier.id_dossier}/corriger-rattachement`, {
      idSignalement: signalementToReorient,
      nouveauIdDossier: cibleDossierId,
      motif,
    });
    setSignalementToReorient(null);
    setCibleDossierId('');
    await loadDossierDetail(selectedDossier.id_dossier);
    await fetchDossiers();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Title & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-isieco-dark flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-isieco-primary" />
            Dossiers Opérationnels de Traitement
          </h2>
          <p className="text-xs text-isieco-muted mt-0.5">
            Pilotage des chantiers de nettoiement, gestion chirurgicale des volets de déchets et rattachements.
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-isieco-primary px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-isieco-primary-dark transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouveau Dossier
        </button>
      </div>

      {(dossiersError || typesError || detailError) && (
        <div className="space-y-2" aria-live="polite">
          {dossiersError && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700" role="alert">
              <span>Erreur de chargement des dossiers : {dossiersError}</span>
              <button type="button" onClick={() => void fetchDossiers()} className="font-semibold underline">Réessayer</button>
            </div>
          )}
          {typesError && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700" role="alert">
              <span>Erreur de chargement des catégories : {typesError}</span>
              <button type="button" onClick={() => void fetchTypesDechets()} className="font-semibold underline">Réessayer</button>
            </div>
          )}
          {detailError && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700" role="alert">
              <span>Erreur de chargement du détail : {detailError}</span>
              <button
                type="button"
                onClick={() => {
                  if (detailDossierId) void loadDossierDetail(detailDossierId);
                }}
                className="font-semibold underline"
              >
                Réessayer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Workspace (Master-Detail) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        {/* Left Dossiers List (4 cols) */}
        <div className="lg:col-span-4 rounded-xl border border-isieco-border bg-white shadow-sm flex flex-col">
          <div className="border-b border-isieco-border p-3.5 bg-gray-50/70 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-isieco-dark">
              Dossiers en cours ({dossiers.length})
            </span>
          </div>

          <div className="divide-y divide-isieco-border overflow-y-auto max-h-[650px] flex-1">
            {dossiers.length === 0 ? (
              <div className="p-8 text-center text-xs text-isieco-muted">
                Aucun dossier opérationnel ouvert.
              </div>
            ) : (
              dossiers.map((d) => (
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
                    <span className="text-xs font-bold text-isieco-dark font-mono">
                      {d.referenceDossier}
                    </span>
                    <StatusBadge status={d.priorite} size="sm" />
                  </div>

                  <p className="text-xs text-gray-800 line-clamp-2 leading-relaxed mb-2 font-medium">
                    {d.descriptionSynthese}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-isieco-muted">
                    <StatusBadge status={d.statutDossier} size="sm" />
                    <span className="flex items-center gap-1 text-[10px]">
                      <Calendar className="h-3 w-3" />
                      {new Date(d.dateCreationDossier).toLocaleDateString('fr-SN')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Dossier Detail & Volets Techniques (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedDossier ? (
            <div className="rounded-xl border border-isieco-border bg-white p-5 shadow-sm space-y-5">
              {/* Header Details */}
              <div className="border-b border-isieco-border pb-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-isieco-dark font-mono">
                      {selectedDossier.reference_dossier}
                    </span>
                    <StatusBadge status={selectedDossier.priorite} />
                    <StatusBadge status={selectedDossier.statut_dossier} />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800 mt-1">
                    {selectedDossier.description_synthese}
                  </h3>
                  <div className="mt-1 text-xs text-isieco-muted">
                    Créé par {selectedDossier.nom_createur} le{' '}
                    {new Date(selectedDossier.date_creation_dossier).toLocaleString('fr-SN')}
                  </div>
                </div>

                <button
                  onClick={() => setTransfertModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Transfert Externe
                </button>
              </div>

              {/* Volets Techniques (CONTENU_DOSSIER) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-isieco-primary" />
                    <h4 className="text-xs font-bold text-isieco-dark uppercase tracking-wider">
                      Volets Techniques de Traitement ({selectedDossier.volets?.length || 0})
                    </h4>
                  </div>
                </div>

                <div className="rounded-lg border border-isieco-border overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-isieco-border text-[11px] font-bold text-isieco-muted uppercase">
                      <tr>
                        <th className="px-3 py-2">Catégorie</th>
                        <th className="px-3 py-2">Estimation</th>
                        <th className="px-3 py-2">Risque</th>
                        <th className="px-3 py-2">État Volet</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-isieco-border">
                      {selectedDossier.volets.map((v) => (
                        <tr key={v.idTypeDechet} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2.5 font-semibold text-isieco-dark">
                            {v.libelle}
                          </td>
                          <td className="px-3 py-2.5 text-isieco-muted">
                            {v.quantiteEstimee || v.volumeEstime || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-semibold text-[10px] text-slate-700">
                              {v.niveauRisque || 'MOYEN'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={v.etatContenuDossier} size="sm" />
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {v.etatContenuDossier === 'INCLUSE' && (
                              <button
                                onClick={() => {
                                  setVoletToRetirer(v.idTypeDechet);
                                  setRetirerModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800"
                              >
                                <Trash2 className="h-3 w-3" />
                                Retirer
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signalements Rattachés (RATTACHEMENT_SIGNALEMENT) */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-isieco-primary" />
                  <h4 className="text-xs font-bold text-isieco-dark uppercase tracking-wider">
                    Signalements Citoyens Rattachés ({selectedDossier.signalements?.length || 0})
                  </h4>
                </div>

                <div className="space-y-2">
                  {selectedDossier.signalements?.length === 0 ? (
                    <div className="p-4 text-center text-xs text-isieco-muted bg-gray-50 rounded-lg">
                      Aucun signalement n est encore rattaché à ce dossier.
                    </div>
                  ) : (
                    selectedDossier.signalements.map((sig) => (
                      <div
                        key={sig.idSignalement}
                        className="rounded-lg border border-isieco-border p-3 text-xs bg-gray-50/50 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-isieco-dark">{sig.description}</div>
                          <div className="text-[11px] text-isieco-muted mt-0.5">
                            Type: <span className="font-bold">{sig.typeRattachement}</span> • Rattaché le :{' '}
                            {new Date(sig.dateRattachement).toLocaleDateString('fr-SN')}
                            {sig.dateFinRattachement && (
                              <span className="text-rose-600 font-bold ml-2">(ARCHIVÉ)</span>
                            )}
                          </div>
                        </div>

                        {!sig.dateFinRattachement && dossiers.length > 1 && (
                          <button
                            onClick={() => {
                              setSignalementToReorient(sig.idSignalement);
                              setReorienterModalOpen(true);
                            }}
                            className="flex items-center gap-1 rounded bg-white border border-isieco-border px-2.5 py-1 text-[11px] font-semibold text-isieco-dark hover:bg-gray-100"
                          >
                            <ArrowRightLeft className="h-3 w-3 text-blue-600" />
                            Réorienter
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-isieco-border p-12 text-center text-xs text-isieco-muted bg-white flex flex-col items-center justify-center min-h-[400px]">
              <FolderKanban className="h-8 w-8 text-gray-300 mb-2" />
              Sélectionnez un dossier dans la liste pour afficher ses volets techniques et signalements rattachés.
            </div>
          )}
        </div>
      </div>

      {/* Modal Nouveau Dossier */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-isieco-border">
            <h3 className="text-base font-bold text-isieco-dark border-b pb-3 mb-4">
              Créer un Nouveau Dossier Opérationnel
            </h3>

            {createError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateDossier} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-isieco-dark mb-1">
                  Description de Synthèse du Chantier <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Nettoyage et curage de dépôts sauvages angle Avenue Faidherbe..."
                  className="w-full rounded-lg border border-isieco-border p-2.5 focus:border-isieco-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-isieco-dark mb-1">
                  Niveau de Priorité Opérationnelle
                </label>
                <select
                  value={priorite}
                  onChange={(e) => setPriorite(e.target.value)}
                  className="w-full rounded-lg border border-isieco-border p-2.5 focus:border-isieco-primary focus:outline-none"
                >
                  <option value="FAIBLE">FAIBLE (Nettoyage programmé standard)</option>
                  <option value="MOYENNE">MOYENNE (Traitement sous 48h)</option>
                  <option value="ELEVEE">ÉLEVÉE (Gêne circulatoire ou volume important)</option>
                  <option value="URGENTE">URGENTE (Risque sanitaire ou obstruction critique)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-isieco-dark mb-2">
                  Volets Techniques à Inclure <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {typesDechets.map((td) => {
                    const checked = selectedCategories.includes(td.idTypeDechet);
                    return (
                      <label
                        key={td.idTypeDechet}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-emerald-50 border-isieco-primary text-emerald-900 font-semibold'
                            : 'border-isieco-border hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories([...selectedCategories, td.idTypeDechet]);
                            } else {
                              setSelectedCategories(
                                selectedCategories.filter((id) => id !== td.idTypeDechet)
                              );
                            }
                          }}
                          className="rounded text-isieco-primary focus:ring-isieco-primary"
                        />
                        <span>{td.libelle}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-isieco-border">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-lg border border-isieco-border px-4 py-2 text-xs font-semibold hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-isieco-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-isieco-primary-dark"
                >
                  Créer le Dossier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Retrait Volet (Test T23) */}
      <ReasonModal
        isOpen={retirerModalOpen}
        title="Retrait d un Volet Technique"
        description="Le retrait d un volet passe son état à RETIRE et conserve l historique sans suppression physique. Un motif d au moins 10 caractères est requis."
        placeholder="Ex: Erreur d inventaire : aucun gravat sur place après inspection terrain..."
        confirmLabel="Retirer le volet"
        isDestructive={true}
        onConfirm={handleConfirmRetirerVolet}
        onClose={() => setRetirerModalOpen(false)}
      />

      {/* Modal Transfert Externe (Test T27) */}
      {transfertModalOpen && (
        <ReasonModal
          isOpen={transfertModalOpen}
          title="Transfert Externe Hors Périmètre Communal"
          description="Transférer ce dossier vers un organisme public ou filière spécialisée (ex: DEEC, SONAGED nationale, UCAD). Spécifiez l organisme et le motif."
          placeholder="Ex: Matières chimiques dangereuses nécessitant l intervention de la brigade spéciale nationale..."
          confirmLabel="Confirmer le transfert externe"
          onConfirm={async (motif) => {
            const org = prompt("Nom de l organisme externe destinataire (ex: DEEC) :");
            if (org) {
              setDestinataireExterne(org);
              await handleConfirmTransfert(motif);
            }
          }}
          onClose={() => setTransfertModalOpen(false)}
        />
      )}

      {/* Modal Réorientation de Rattachement (Test T04) */}
      {reorienterModalOpen && (
        <ReasonModal
          isOpen={reorienterModalOpen}
          title="Corriger le Rattachement du Signalement"
          description="Cette opération archive l ancien lien et crée le nouveau lien sans supprimer l historique. Spécifiez le motif de correction."
          placeholder="Ex: Dépôt réorienté vers le dossier de la rue adjacente..."
          confirmLabel="Confirmer la réorientation"
          onConfirm={async (motif) => {
            const idCible = prompt("Identifiant du nouveau dossier cible (UUID) :");
            if (idCible) {
              setCibleDossierId(idCible);
              await handleConfirmReorienter(motif);
            }
          }}
          onClose={() => setReorienterModalOpen(false)}
        />
      )}
    </div>
  );
};
