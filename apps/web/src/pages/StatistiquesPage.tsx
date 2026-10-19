import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';
import {
  BarChart3,
  TrendingUp,
  Inbox,
  FolderKanban,
  CheckCircle2,
  RotateCcw,
  RefreshCw,
  Info,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

interface Indicateurs {
  observationsRecues: number;
  dossiersCrees: number;
  dossiersCloturesResolus: number;
  tauxResolutionGlobalPct: number;
  affectationsAttribuees: number;
  interventionsTerminees: number;
  resolutionsVerifieesConformes: number;
  reouverturesTracees: number;
}

export const StatistiquesPage: React.FC = () => {
  const [data, setData] = useState<Indicateurs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{
        success: boolean;
        indicateurs: Indicateurs;
        definitions: { rg58: string; rg59: string };
      }>('/api/statistiques/indicateurs');
      setData(res.indicateurs);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des indicateurs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-isieco-dark tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-isieco-primary" />
            Tableau de Bord & Indicateurs de Salubrité
          </h1>
          <p className="text-sm text-isieco-muted mt-0.5">
            Territoire Dakar-Plateau & Médina • Respect strict des règles d'étanchéité statistique RG58 et RG59
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-isieco-primary' : ''}`} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center p-16 text-sm text-isieco-muted">
          <RefreshCw className="h-6 w-6 animate-spin text-isieco-primary mr-2" />
          Chargement des indicateurs consolidés...
        </div>
      ) : data ? (
        <>
          {/* Main KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Taux Résolution */}
            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-100">
                  Taux Résolution Global
                </span>
                <TrendingUp className="h-5 w-5 text-emerald-200" />
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-black tracking-tight">
                  {data.tauxResolutionGlobalPct}%
                </span>
                <span className="text-xs text-emerald-100">des dossiers résolus</span>
              </div>
              <div className="mt-3 w-full bg-emerald-900/30 rounded-full h-2">
                <div
                  className="bg-white rounded-full h-2 transition-all duration-500"
                  style={{ width: `${Math.min(data.tauxResolutionGlobalPct, 100)}%` }}
                />
              </div>
            </div>

            {/* Observations Citoyennes (RG58) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Observations Brutes
                </span>
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <Inbox className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 text-3xl font-black text-slate-900">
                {data.observationsRecues}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Signalements soumis (Comptage étanche RG58)
              </p>
            </div>

            {/* Dossiers Opérationnels (RG58) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Dossiers Opérationnels
                </span>
                <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                  <FolderKanban className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 text-3xl font-black text-slate-900">
                {data.dossiersCrees}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Dont <strong className="text-emerald-700">{data.dossiersCloturesResolus}</strong> clôturés avec succès
              </p>
            </div>

            {/* Réouvertures (RG59) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Réouvertures Tracées
                </span>
                <div className="rounded-lg bg-orange-50 p-2 text-orange-600">
                  <RotateCcw className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 text-3xl font-black text-slate-900">
                {data.reouverturesTracees}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Non-conformité terrain (Comptage étanche RG59)
              </p>
            </div>
          </div>

          {/* Operational Pipeline Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Pipeline Terrain</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                  <span className="text-slate-600">Affectations attribuées</span>
                  <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {data.affectationsAttribuees}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                  <span className="text-slate-600">Interventions terminées</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {data.interventionsTerminees}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Contrôle Qualité</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                  <span className="text-slate-600">Vérifications conformes</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {data.resolutionsVerifieesConformes}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                  <span className="text-slate-600">Clôtures finales confirmées</span>
                  <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {data.dossiersCloturesResolus}
                  </span>
                </div>
              </div>
            </div>

            {/* Règles Métier RG58 / RG59 explicatives */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5 space-y-3">
              <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wider">
                <Info className="h-4 w-4" />
                Invariants Statistiques
              </div>
              <div className="space-y-2 text-xs text-blue-950">
                <div className="bg-white/80 p-2.5 rounded-xl border border-blue-100">
                  <strong className="text-blue-900">Règle RG58 :</strong> Les observations citoyennes ({data.observationsRecues}) et les dossiers d'intervention ({data.dossiersCrees}) sont deux grandeurs distinctes (1 dossier peut regrouper N signalements).
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-blue-100">
                  <strong className="text-blue-900">Règle RG59 :</strong> Les résolutions vérifiées ({data.resolutionsVerifieesConformes}) et les réouvertures ({data.reouverturesTracees}) sont comptabilisées séparément sans compensation arithmétique.
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

