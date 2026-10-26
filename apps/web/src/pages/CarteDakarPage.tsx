import React, { useState, useEffect } from 'react';
import type { CartePoint, CartePointsResponse, SignalementSansCoordonnees } from '@isieco/shared';
import { api } from '../api/client.js';
import { StatusBadge } from '../components/ui/StatusBadge.js';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, RefreshCw, Layers, AlertCircle, Calendar } from 'lucide-react';

// Custom Leaflet Icons for Dakar
const markerIconGreen = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const markerIconOrange = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export const CarteDakarPage: React.FC = () => {
  const [points, setPoints] = useState<CartePoint[]>([]);
  const [sansCoordonnees, setSansCoordonnees] = useState<SignalementSansCoordonnees[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchPoints = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get<CartePointsResponse>('/carte/points');
      setPoints(res.pointsGeolocalises || []);
      setSansCoordonnees(res.sansCoordonnees || []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Impossible de charger les données cartographiques.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoints();
  }, []);

  // Coordonnées centrales : Dakar-Plateau / Médina
  const dakarCenter: [number, number] = [14.6735, -17.435];

  return (
    <div className="ops-workflow-page ops-map-page p-6 space-y-6">
      {/* Title */}
      <div className="ops-workflow-heading flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-isieco-dark flex items-center gap-2">
            <MapPin className="h-6 w-6 text-isieco-primary" />
            Cartographie Interactive de Salubrité — Presqu’île de Dakar
          </h2>
          <p className="text-xs text-isieco-muted mt-0.5">
            Territoire : Communes d Arrondissement de Dakar-Plateau et Médina (OpenStreetMap / Leaflet).
          </p>
        </div>
        <button
          onClick={fetchPoints}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-isieco-border bg-white px-3 py-1.5 text-xs font-semibold text-isieco-dark shadow-sm hover:bg-gray-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualiser la carte
        </button>
      </div>

      <div className="ops-workflow-metrics" aria-label="Aperçu cartographique">
        <article className="ops-workflow-metric">
          <span>Points géolocalisés</span>
          <strong>{loading ? '—' : points.length}</strong>
          <small>Dossiers et signalements</small>
        </article>
        <article className="ops-workflow-metric">
          <span>Repères textuels</span>
          <strong>{loading ? '—' : sansCoordonnees.length}</strong>
          <small>À localiser sur le terrain</small>
        </article>
        <article className="ops-workflow-metric">
          <span>Zone affichée</span>
          <strong>Dakar</strong>
          <small>Plateau et Médina</small>
        </article>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700" role="alert">
          <span>Erreur de chargement : {loadError}</span>
          <button type="button" onClick={() => void fetchPoints()} className="font-semibold underline">
            Réessayer
          </button>
        </div>
      )}

      {/* Main Map + Side List */}
      <div className="ops-workflow-grid ops-map-layout grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        
        {/* Left : Leaflet Map (8 cols) */}
        <div className="ops-workflow-panel ops-map-panel lg:col-span-8 rounded-xl border border-isieco-border bg-white overflow-hidden shadow-sm flex flex-col h-[650px]">
          <div className="border-b border-isieco-border p-3 bg-gray-50 flex items-center justify-between text-xs">
            <span className="font-bold text-isieco-dark uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4 text-isieco-primary" />
              Vue Territoriale ({points.length} points géolocalisés)
            </span>
            <div className="ops-map-legend flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-gray-700">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 inline-block" />
                Dossiers Opérationnels
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-gray-700">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
                Signalements Citoyens
              </span>
            </div>
          </div>

          <div className="flex-1 w-full h-full relative z-10">
            <MapContainer
              center={dakarCenter}
              zoom={14}
              scrollWheelZoom={true}
              className="ops-leaflet-map"
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {points.map((pt) => {
                const lat = Number(pt.latitude);
                const lon = Number(pt.longitude);
                if (isNaN(lat) || isNaN(lon)) return null;

                const isDossier = pt.typeObjet === 'DOSSIER';

                return (
                  <Marker
                    key={`${pt.typeObjet}-${pt.id}`}
                    position={[lat, lon]}
                    icon={isDossier ? markerIconGreen : markerIconOrange}
                  >
                    <Popup>
                      <div className="p-1 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2 border-b pb-1">
                          <span className="font-bold text-slate-800 font-mono">
                            {pt.reference}
                          </span>
                          <StatusBadge status={pt.statut} size="sm" />
                        </div>
                        <p className="font-semibold text-gray-800 text-[11px]">
                          {pt.description}
                        </p>
                        <div className="text-[10px] text-gray-500">
                          Coordonnées : {lat.toFixed(4)}, {lon.toFixed(4)}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>

        {/* Right : Liste des signalements sans GPS (4 cols) (Test T37) */}
        <div className="ops-workflow-panel ops-map-panel lg:col-span-4 rounded-xl border border-isieco-border bg-white shadow-sm flex flex-col h-[650px]">
          <div className="border-b border-isieco-border p-3.5 bg-gray-50/70">
            <span className="text-xs font-bold uppercase tracking-wider text-isieco-dark block">
              Dépôts sans GPS exploitables ({sansCoordonnees.length})
            </span>
            <p className="text-[11px] text-isieco-muted mt-0.5">
              Signalements déclarés avec repère textuel de lieu (affectation différée).
            </p>
          </div>

          <div className="divide-y divide-isieco-border overflow-y-auto flex-1">
            {sansCoordonnees.length === 0 ? (
              <div className="p-8 text-center text-xs text-isieco-muted">
                {loading
                  ? 'Chargement des signalements…'
                  : loadError
                    ? 'Les signalements sans coordonnées ne sont pas disponibles.'
                    : 'Tous les signalements reçus disposent de coordonnées GPS valides.'}
              </div>
            ) : (
              sansCoordonnees.map((s) => (
                <div key={s.idSignalement} className="p-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-bold">
                      Repère Textuel
                    </span>
                    <StatusBadge status={s.statutSignalement} size="sm" />
                  </div>

                  <p className="text-xs font-medium text-gray-800 leading-relaxed mb-1.5">
                    {s.description}
                  </p>

                  <div className="rounded bg-amber-50/80 p-2 border border-amber-200 text-xs text-amber-900 mb-1.5 font-medium">
                    📍 {s.descriptionLocalisation || 'Repère non renseigné'}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-isieco-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(s.dateSoumission).toLocaleDateString('fr-SN')}
                    </span>
                    <span className="text-blue-600 font-semibold">À localiser sur site</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
