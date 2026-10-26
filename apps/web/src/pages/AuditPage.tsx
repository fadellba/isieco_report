import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { RoleCode } from '@isieco/shared';
import {
  ScrollText,
  Filter,
  RefreshCw,
  Search,
  Eye,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { ReasonModal } from '../components/ui/ReasonModal.js';

interface AuditEvent {
  idEvenement: string;
  typeEvenement: string;
  dateEvenement: string | null;
  dateEnregistrement: string;
  origine: string;
  idActeur: string;
  nomActeur: string | null;
  prenomActeur: string | null;
  idSignalementCible: string | null;
  idDossierCible: string | null;
  idRattachementCible: string | null;
  idAffectationCible: string | null;
  idInterventionCible: string | null;
  idVerificationCible: string | null;
  idUtilisateurCible: string | null;
  idEvenementCorrige: string | null;
  donneesAvant: string | null;
  donneesApres: string | null;
  destinataireExterne: string | null;
  motif: string | null;
  correlationId: string | null;
}

export const AuditPage: React.FC = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(RoleCode.ADMIN);

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<string>('');
  const [filterDossier, setFilterDossier] = useState<string>('');
  const [filterSignalement, setFilterSignalement] = useState<string>('');

  // Selected event for payload inspector
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  // Correction modal (Test T18)
  const [correctingEvent, setCorrectingEvent] = useState<AuditEvent | null>(null);
  const [correctionType, setCorrectionType] = useState<string>('EVENEMENT_CORRIGE');

  const fetchAuditTrail = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('typeEvenement', filterType);
      if (filterDossier) params.append('idDossierCible', filterDossier);
      if (filterSignalement) params.append('idSignalementCible', filterSignalement);
      params.append('limit', '50');

      const res = await apiClient.get<{ success: boolean; data: AuditEvent[] }>(
        `/api/evenements/audit-trail?${params.toString()}`
      );
      setEvents(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement de la piste d audit.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditTrail();
  }, [filterType]);

  const handleApplyCorrection = async (motif: string) => {
    if (!correctingEvent) return;
    try {
      await apiClient.post(`/api/evenements/${correctingEvent.idEvenement}/corriger`, {
        nouveauType: correctionType,
        motif,
      });
      setCorrectingEvent(null);
      await fetchAuditTrail();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la correction');
    }
  };

  return (
    <div className="ops-workflow-page p-6 space-y-6">
      {/* Header */}
      <div className="ops-workflow-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-isieco-dark tracking-tight flex items-center gap-2">
            <ScrollText className="h-7 w-7 text-isieco-primary" />
            Piste d'Audit & Journal Événementiel Immuable
          </h1>
          <p className="text-sm text-isieco-muted mt-0.5">
            Livre de comptes d'ingénierie • Traçabilité stricte avec cible unique (T17/T32) et correction par append-only (T18)
          </p>
        </div>
        <button
          onClick={fetchAuditTrail}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-isieco-primary' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Filters Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <Filter className="h-4 w-4 text-slate-400" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="">Tous les types d'événements</option>
          <option value="SIGNALEMENT_CREE">SIGNALEMENT_CREE</option>
          <option value="DOSSIER_CREE">DOSSIER_CREE</option>
          <option value="RATTACHEMENT_VALIDE">RATTACHEMENT_VALIDE</option>
          <option value="AFFECTATION_CREEE">AFFECTATION_CREEE</option>
          <option value="INTERVENTION_TERMINEE">INTERVENTION_TERMINEE</option>
          <option value="VERIFICATION_EFFECTUEE">VERIFICATION_EFFECTUEE</option>
          <option value="DOSSIER_CLOTURE">DOSSIER_CLOTURE</option>
          <option value="DOSSIER_REOUVERT">DOSSIER_REOUVERT</option>
          <option value="DOSSIER_TRANSFERE">DOSSIER_TRANSFERE</option>
          <option value="EVENEMENT_CORRIGE">EVENEMENT_CORRIGE</option>
        </select>

        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="UUID Dossier cible..."
            value={filterDossier}
            onChange={(e) => setFilterDossier(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <button
          onClick={fetchAuditTrail}
          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
        >
          Filtrer
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700" role="alert">
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date & Enregistrement</th>
                <th className="py-3 px-4">Type Événement</th>
                <th className="py-3 px-4">Acteur</th>
                <th className="py-3 px-4">Cible Concernée</th>
                <th className="py-3 px-4">Motif</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Aucun événement trouvé dans le journal.
                  </td>
                </tr>
              ) : (
                events.map((ev) => {
                  const eventDate = new Date(ev.dateEvenement || ev.dateEnregistrement);
                  const formattedEventDate = Number.isNaN(eventDate.getTime())
                    ? 'Date indisponible'
                    : eventDate.toLocaleString('fr-SN', {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      });
                  const targetLabel = ev.idDossierCible
                    ? `Dossier: ${ev.idDossierCible.substring(0, 8)}...`
                    : ev.idSignalementCible
                    ? `Signalement: ${ev.idSignalementCible.substring(0, 8)}...`
                    : ev.idInterventionCible
                    ? `Intervention: ${ev.idInterventionCible.substring(0, 8)}...`
                    : ev.idAffectationCible
                    ? `Affectation: ${ev.idAffectationCible.substring(0, 8)}...`
                    : ev.idUtilisateurCible
                    ? `Utilisateur: ${ev.idUtilisateurCible.substring(0, 8)}...`
                    : 'Global / Autre';

                  return (
                    <tr key={ev.idEvenement} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {formattedEventDate}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          UUID: {ev.idEvenement.substring(0, 8)}...
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            ev.typeEvenement.includes('CORRIGE')
                              ? 'bg-purple-100 text-purple-800'
                              : ev.typeEvenement.includes('REOUVERT')
                              ? 'bg-amber-100 text-amber-800'
                              : ev.typeEvenement.includes('CLOTURE')
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {ev.idEvenementCorrige && (
                            <AlertTriangle className="h-3 w-3 text-purple-600" />
                          )}
                          {ev.typeEvenement}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {ev.nomActeur || ev.prenomActeur ? (
                          <span className="font-semibold text-slate-900">
                            {ev.prenomActeur} {ev.nomActeur}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">
                            {ev.idActeur ? ev.idActeur.substring(0, 8) : 'Système'}
                          </span>
                        )}
                        <div className="text-[10px] text-slate-400">{ev.origine}</div>
                      </td>

                      <td className="py-3 px-4 text-slate-700">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-slate-800">
                          {targetLabel}
                        </span>
                        {ev.idEvenementCorrige && (
                          <div className="text-[10px] text-purple-700 mt-1">
                            Rectifie : {ev.idEvenementCorrige.substring(0, 8)}...
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={ev.motif || ''}>
                        {ev.motif || <span className="text-slate-300 italic">Aucun</span>}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedEvent(ev)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                            title="Inspecter le payload"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {isAdmin && !ev.typeEvenement.includes('CORRIGE') && (
                            <button
                              onClick={() => {
                                setCorrectingEvent(ev);
                                setCorrectionType(`CORRECTION_${ev.typeEvenement}`);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 text-[11px] font-semibold transition"
                              title="Corriger de manière immuable (Test T18)"
                            >
                              Corriger
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

      {/* JSON Payload Inspector Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-isieco-primary" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Détail de l'événement #{selectedEvent.idEvenement.substring(0, 8)}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">TYPE</span>
                  <span className="font-bold text-slate-800">{selectedEvent.typeEvenement}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">HORODATAGE</span>
                  <span className="text-slate-800">{selectedEvent.dateEvenement}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CORRELATION ID</span>
                  <span className="text-slate-800">{selectedEvent.correlationId || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">ORIGINE</span>
                  <span className="text-slate-800">{selectedEvent.origine}</span>
                </div>
              </div>

              {selectedEvent.motif && (
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Motif explicite
                  </label>
                  <p className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-800 font-medium">
                    {selectedEvent.motif}
                  </p>
                </div>
              )}

              {selectedEvent.donneesAvant && (
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Données Avant (État précédent)
                  </label>
                  <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl overflow-x-auto text-[11px] font-mono">
                    {JSON.stringify(
                      typeof selectedEvent.donneesAvant === 'string'
                        ? JSON.parse(selectedEvent.donneesAvant)
                        : selectedEvent.donneesAvant,
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}

              {selectedEvent.donneesApres && (
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Données Après (Nouvel état)
                  </label>
                  <pre className="p-3 bg-slate-950 text-amber-300 rounded-xl overflow-x-auto text-[11px] font-mono">
                    {JSON.stringify(
                      typeof selectedEvent.donneesApres === 'string'
                        ? JSON.parse(selectedEvent.donneesApres)
                        : selectedEvent.donneesApres,
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-xl text-xs hover:bg-slate-800 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de correction immuable (Test T18) */}
      <ReasonModal
        isOpen={Boolean(correctingEvent)}
        title={`Rectification immuable de l'événement`}
        confirmLabel="Enregistrer la correction (Append-Only)"
        placeholder="Indiquez obligatoirement la justification d'ingénierie et le motif de rectification..."
        minChars={10}
        onClose={() => setCorrectingEvent(null)}
        onConfirm={handleApplyCorrection}
      />
    </div>
  );
};
