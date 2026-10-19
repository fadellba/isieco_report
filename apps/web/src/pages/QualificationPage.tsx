import React, { useState, useEffect, useRef } from 'react';
import type {
  ApiDataResponse,
  ApiListResponse,
  SignalementDoublonCandidat,
  SignalementPhotoItem,
  SignalementQualification,
} from '@isieco/shared';
import { api } from '../api/client.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { ReasonModal } from '../components/ui/ReasonModal.js';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Eye,
  MapPin,
  Calendar,
  Layers,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

export const QualificationPage: React.FC = () => {
  const [signalements, setSignalements] = useState<SignalementQualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSignalement, setSelectedSignalement] = useState<SignalementQualification | null>(null);
  const [doublons, setDoublons] = useState<SignalementDoublonCandidat[]>([]);
  const [loadingDoublons, setLoadingDoublons] = useState(false);
  const [photos, setPhotos] = useState<SignalementPhotoItem[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const selectedSignalementId = useRef<string | null>(null);

  // Modale de rejet avec motif
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [signalementToReject, setSignalementToReject] = useState<string | null>(null);

  const fetchInbox = async () => {
    try {
      setLoading(true);
      const res = await api.get<ApiListResponse<SignalementQualification>>('/qualification/boite-reception');
      setSignalements(res.data || []);
      if (res.data && res.data.length > 0 && !selectedSignalement) {
        handleSelectSignalement(res.data[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, []);

  const handleSelectSignalement = async (sig: SignalementQualification) => {
    selectedSignalementId.current = sig.idSignalement;
    setSelectedSignalement(sig);
    setLoadingDoublons(true);
    setLoadingPhotos(true);
    setPhotos([]);
    setPhotoError(null);

    const [duplicatesResult, detailResult] = await Promise.allSettled([
      api.get<{ candidates: SignalementDoublonCandidat[] }>(
        `/qualification/doublons-candidats/${sig.idSignalement}`
      ),
      api.get<ApiDataResponse<{ photos: SignalementPhotoItem[] }>>(
        `/signalements/${sig.idSignalement}`
      ),
    ]);

    if (selectedSignalementId.current !== sig.idSignalement) return;

    if (duplicatesResult.status === 'fulfilled') {
      setDoublons(duplicatesResult.value.candidates || []);
    } else {
      setDoublons([]);
    }
    setLoadingDoublons(false);

    if (detailResult.status === 'fulfilled') {
      setPhotos(detailResult.value.data.photos || []);
    } else {
      setPhotoError('Impossible de charger les photos de ce signalement.');
    }
    setLoadingPhotos(false);
  };

  const handleExaminer = async (id: string) => {
    await api.post(`/qualification/signalements/${id}/examiner`);
    await fetchInbox();
  };

  const handleQualifier = async (id: string) => {
    await api.post(`/qualification/signalements/${id}/qualifier`, {
      motif: 'Signalement recevable, géolocalisé et conforme aux critères de salubrité.',
    });
    setSelectedSignalement(null);
    await fetchInbox();
  };

  const handleConfirmRejet = async (motif: string) => {
    if (!signalementToReject) return;
    await api.post(`/qualification/signalements/${signalementToReject}/rejeter`, { motif });
    setSelectedSignalement(null);
    setSignalementToReject(null);
    await fetchInbox();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Title & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-isieco-dark flex items-center gap-2">
            <Inbox className="h-6 w-6 text-isieco-primary" />
            Boîte de Qualification & Doublons
          </h2>
          <p className="text-xs text-isieco-muted mt-0.5">
            Examen des observations citoyennes, détection de doublons par distance géodésique et orientation.
          </p>
        </div>
        <button
          onClick={fetchInbox}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-isieco-border bg-white px-3 py-1.5 text-xs font-semibold text-isieco-dark shadow-sm hover:bg-gray-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Main Split-View Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        
        {/* Left Column : Inbox List (5 cols) */}
        <div className="lg:col-span-5 rounded-xl border border-isieco-border bg-white shadow-sm flex flex-col">
          <div className="border-b border-isieco-border p-3.5 bg-gray-50/70 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-isieco-dark">
              En attente d examen ({signalements.length})
            </span>
          </div>

          <div className="divide-y divide-isieco-border overflow-y-auto max-h-[650px] flex-1">
            {signalements.length === 0 ? (
              <div className="p-8 text-center text-xs text-isieco-muted">
                Aucun signalement en attente de qualification.
              </div>
            ) : (
              signalements.map((s) => (
                <div
                  key={s.idSignalement}
                  onClick={() => handleSelectSignalement(s)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedSignalement?.idSignalement === s.idSignalement
                      ? 'bg-emerald-50/70 border-l-4 border-isieco-primary'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-isieco-dark">
                      {s.prenomDeclarant ? `${s.prenomDeclarant} ${s.nomDeclarant}` : s.nomDeclarant}
                    </span>
                    <StatusBadge status={s.statutSignalement} size="sm" />
                  </div>

                  <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed mb-2">
                    {s.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-isieco-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(s.dateSoumission).toLocaleDateString('fr-SN')}
                    </span>
                    {s.latitude ? (
                      <span className="flex items-center gap-1 text-emerald-700">
                        <MapPin className="h-3 w-3" />
                        GPS Vérifié
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-700">
                        <MapPin className="h-3 w-3" />
                        Repère Textuel
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column : Split View Comparateur & Doublons (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedSignalement ? (
            <div className="rounded-xl border border-isieco-border bg-white p-5 shadow-sm space-y-4">
              {/* Selected Signalement Details */}
              <div className="border-b border-isieco-border pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                      ID: {selectedSignalement.idSignalement.substring(0, 8)}-{selectedSignalement.idSignalement.slice(-4)}
                    </span>
                    <h3 className="text-base font-bold text-isieco-dark mt-1">
                      Observation de {selectedSignalement.nomDeclarant}
                    </h3>
                  </div>
                  <StatusBadge status={selectedSignalement.statutSignalement} />
                </div>

                <p className="mt-3 text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-100 leading-relaxed">
                  {selectedSignalement.description}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded bg-slate-50 p-2 border border-slate-200">
                    <span className="font-semibold text-isieco-muted block text-[10px] uppercase">
                      Localisation
                    </span>
                    {selectedSignalement.latitude ? (
                      <span className="font-mono text-emerald-800">
                        {selectedSignalement.latitude}, {selectedSignalement.longitude}
                      </span>
                    ) : (
                      <span className="text-amber-800 font-medium">
                        {selectedSignalement.descriptionLocalisation || 'Non spécifié'}
                      </span>
                    )}
                  </div>

                  <div className="rounded bg-slate-50 p-2 border border-slate-200">
                    <span className="font-semibold text-isieco-muted block text-[10px] uppercase">
                      Date de Soumission
                    </span>
                    <span>{new Date(selectedSignalement.dateSoumission).toLocaleString('fr-SN')}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-isieco-muted">
                  Photos de preuve
                </h4>
                {loadingPhotos ? (
                  <p className="mt-2 text-xs text-isieco-muted">Chargement des photos...</p>
                ) : photoError ? (
                  <p className="mt-2 text-xs text-rose-700">{photoError}</p>
                ) : photos.filter((photo) =>
                    photo.referencePhoto.startsWith('/api/signalements/')
                  ).length === 0 ? (
                  <p className="mt-2 text-xs text-isieco-muted">Aucune photo associée.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {photos
                      .filter((photo) =>
                        photo.referencePhoto.startsWith('/api/signalements/')
                      )
                      .map((photo) => (
                        <figure key={photo.idPhoto} className="w-36">
                          <img
                            src={photo.referencePhoto}
                            alt={photo.description || 'Photo de preuve du signalement'}
                            className="h-28 w-36 rounded-lg border border-slate-200 object-cover"
                          />
                          {photo.description && (
                            <figcaption className="mt-1 text-[10px] text-slate-600">
                              {photo.description}
                            </figcaption>
                          )}
                        </figure>
                      ))}
                  </div>
                )}
              </div>

              {/* Doublons Candidats (Split-View) */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="h-4 w-4 text-isieco-primary" />
                  <h4 className="text-xs font-bold text-isieco-dark uppercase tracking-wider">
                    Détection de Doublons Géographiques (&lt; 500m)
                  </h4>
                </div>

                {loadingDoublons ? (
                  <div className="p-4 text-center text-xs text-isieco-muted">
                    Analyse des proximités géodésiques en cours...
                  </div>
                ) : doublons.length === 0 ? (
                  <div className="rounded-lg bg-emerald-50/70 p-3 text-xs text-emerald-800 border border-emerald-200">
                    ✓ Aucun doublon détecté dans un rayon de 500 mètres. Observation unique présumée.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-amber-800 font-medium bg-amber-50 p-2 rounded border border-amber-200">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      <span>{doublons.length} observation(s) similaire(s) trouvée(s) à proximité immédiate :</span>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {doublons.map((cand) => (
                        <div
                          key={cand.idSignalement}
                          className="rounded-lg border border-amber-200 bg-white p-3 text-xs shadow-sm flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-isieco-dark">{cand.description}</div>
                            <div className="text-[11px] text-isieco-muted mt-0.5">
                              Distance : <span className="font-bold text-amber-700">{cand.distanceMetres} mètres</span> • Statut : {cand.statutSignalement}
                            </div>
                          </div>
                          <span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
                            Doublon Probable
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="border-t border-isieco-border pt-4 flex flex-wrap items-center justify-between gap-3">
                {selectedSignalement.statutSignalement === 'SOUMIS' && (
                  <button
                    onClick={() => handleExaminer(selectedSignalement.idSignalement)}
                    className="flex items-center gap-1.5 rounded-lg border border-isieco-border px-3 py-2 text-xs font-semibold text-isieco-dark hover:bg-gray-100"
                  >
                    <Eye className="h-4 w-4 text-blue-600" />
                    Prendre en cours d examen
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => {
                      setSignalementToReject(selectedSignalement.idSignalement);
                      setRejectModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                    Rejeter avec motif
                  </button>

                  <button
                    onClick={() => handleQualifier(selectedSignalement.idSignalement)}
                    className="flex items-center gap-1.5 rounded-lg bg-isieco-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-isieco-primary-dark transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Accepter pour Rattachement (+10 pts)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-isieco-border p-12 text-center text-xs text-isieco-muted bg-white flex flex-col items-center justify-center min-h-[400px]">
              <Inbox className="h-8 w-8 text-gray-300 mb-2" />
              Sélectionnez une observation dans la boîte de gauche pour examiner ses détails et détecter ses doublons.
            </div>
          )}
        </div>

      </div>

      {/* Rejection Modal with Mandatory Reason (>= 10 characters) */}
      <ReasonModal
        isOpen={rejectModalOpen}
        title="Rejet de l observation citoyenne"
        description="Veuillez spécifier un motif explicite d au moins 10 caractères justifiant le rejet de ce signalement. Cette information sera tracée dans le journal d audit immuable et notifiée au citoyen."
        placeholder="Ex: Signalement hors compétence territoriale ou doublon déjà pris en charge sur un dossier existant..."
        confirmLabel="Confirmer le rejet et notifier"
        isDestructive={true}
        onConfirm={handleConfirmRejet}
        onClose={() => setRejectModalOpen(false)}
      />
    </div>
  );
};
