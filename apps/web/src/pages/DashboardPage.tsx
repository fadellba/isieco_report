import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Crosshair,
  Layers3,
  MapPin,
  RefreshCw,
  Signal,
  Truck,
  X,
} from 'lucide-react';
import { RoleCode } from '@isieco/shared';
import type { CartePoint, CartePointsResponse } from '@isieco/shared';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import './dashboard.css';
import 'leaflet/dist/leaflet.css';

type MapPoint = CartePoint;
type PointType = CartePoint['typeObjet'];
type PointFilter = 'TOUS' | PointType;

const pointTypes: PointType[] = ['SIGNALEMENT', 'DOSSIER', 'INTERVENTION'];
const pointTypeLabels: Record<PointType, string> = {
  SIGNALEMENT: 'Signalements',
  DOSSIER: 'Dossiers',
  INTERVENTION: 'Missions',
};

const dakarCenter: [number, number] = [14.6937, -17.4441];

const markerIcons = {
  DOSSIER: L.divIcon({
    className: 'ops-marker',
    html: '<span class="ops-marker__dot ops-marker__dot--dossier"></span>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  }),
  SIGNALEMENT: L.divIcon({
    className: 'ops-marker',
    html: '<span class="ops-marker__dot ops-marker__dot--signalement"></span>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  }),
  INTERVENTION: L.divIcon({
    className: 'ops-marker',
    html: '<span class="ops-marker__dot ops-marker__dot--intervention">🚛</span>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  }),
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date indisponible'
    : date.toLocaleString('fr-SN', { dateStyle: 'short', timeStyle: 'short' });
};

const statusLabel = (status: string) =>
  status.replaceAll('_', ' ').toLocaleLowerCase('fr-SN');

const FlyToSelectedPoint: React.FC<{ point: MapPoint | null }> = ({ point }) => {
  const map = useMap();

  useEffect(() => {
    if (!point) return;
    const latitude = Number(point.latitude);
    const longitude = Number(point.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), { duration: 0.7 });
  }, [map, point]);

  return null;
};

export const DashboardPage: React.FC<{ initialFilter?: PointFilter }> = ({
  initialFilter = 'TOUS',
}) => {
  const { hasAnyRole } = useAuth();
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [unlocatedCount, setUnlocatedCount] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [feedFilter, setFeedFilter] = useState<PointFilter>(initialFilter);
  const [visibleLayers, setVisibleLayers] = useState<Record<PointType, boolean>>({
    SIGNALEMENT: true,
    DOSSIER: true,
    INTERVENTION: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMapData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<CartePointsResponse>('/carte/points');
      setPoints(response.pointsGeolocalises);
      setUnlocatedCount(response.totalSansCoordonnees);
      setSelectedPoint((current) =>
        current
          ? response.pointsGeolocalises.find(
              (point) => point.id === current.id && point.typeObjet === current.typeObjet
            ) ?? null
          : null
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les données cartographiques.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMapData();
  }, [loadMapData]);

  const mapPoints = useMemo(
    () => points.filter((point) => visibleLayers[point.typeObjet]),
    [points, visibleLayers]
  );
  const filteredFeedPoints = useMemo(
    () => points.filter((point) => feedFilter === 'TOUS' || point.typeObjet === feedFilter),
    [feedFilter, points]
  );
  const dossierCount = points.filter((point) => point.typeObjet === 'DOSSIER').length;
  const signalementCount = points.filter((point) => point.typeObjet === 'SIGNALEMENT').length;
  const interventionCount = points.filter((point) => point.typeObjet === 'INTERVENTION').length;
  const canQualify = hasAnyRole([
    RoleCode.QUALIFICATION,
    RoleCode.TRAITEMENT,
    RoleCode.ADMIN,
  ]);
  const canVerify = hasAnyRole([RoleCode.VERIFICATION, RoleCode.ADMIN]);
  const canAssign = hasAnyRole([RoleCode.AFFECTATION, RoleCode.ADMIN]);
  const canManageDossiers = hasAnyRole([RoleCode.TRAITEMENT, RoleCode.ADMIN]);
  const pageTitle = initialFilter === 'INTERVENTION' ? 'Missions terrain' : 'Situation de la salubrité';
  const missionDestination = canVerify
    ? { to: '/verifications', label: 'Ouvrir le contrôle' }
    : canAssign
      ? { to: '/affectations', label: 'Voir les affectations' }
      : canManageDossiers
        ? { to: '/dossiers', label: 'Ouvrir les dossiers' }
        : null;

  return (
    <section className="ops-dashboard" aria-label={pageTitle}>
      <div className="ops-dashboard__heading">
        <div>
          <div className="ops-eyebrow"><span /> OBSERVATOIRE DE LA SALUBRITÉ · DAKAR</div>
          <h1>{pageTitle}</h1>
          <p>Dépôts signalés, interventions de collecte et résolutions sur le territoire pilote.</p>
        </div>
        <div className="ops-dashboard__actions">
          <span className="ops-live"><Signal size={13} /> {loading ? 'SYNCHRONISATION' : 'DONNÉES API'}</span>
          <button
            className="ops-icon-button"
            type="button"
            title="Actualiser les données"
            aria-label="Actualiser les données"
            onClick={() => void loadMapData()}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'ops-spin' : ''} />
          </button>
          {initialFilter === 'INTERVENTION' && missionDestination ? (
            <Link to={missionDestination.to} className="ops-primary-link">
              {missionDestination.label} <ArrowUpRight size={15} />
            </Link>
          ) : canQualify && (
            <Link to="/qualification" className="ops-primary-link">
              Ouvrir les signalements <ArrowUpRight size={15} />
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="ops-error" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button type="button" onClick={() => void loadMapData()}>Réessayer</button>
        </div>
      )}

      <div className="ops-metrics" aria-label="Indicateurs cartographiques">
        <article className="ops-metric">
          <span className="ops-metric__icon"><MapPin size={16} /></span>
          <div><span>Points cartographiés</span><strong>{loading ? '—' : points.length}</strong></div>
          <small>Géolocalisés</small>
        </article>
        <article className="ops-metric">
          <span className="ops-metric__icon ops-metric__icon--amber"><Activity size={16} /></span>
          <div><span>Signalements</span><strong>{loading ? '—' : signalementCount}</strong></div>
          <small>Sur la carte</small>
        </article>
        <article className="ops-metric">
          <span className="ops-metric__icon ops-metric__icon--blue"><Layers3 size={16} /></span>
          <div><span>Dossiers</span><strong>{loading ? '—' : dossierCount}</strong></div>
          <small>Sur la carte</small>
        </article>
        <article className="ops-metric">
          <span className="ops-metric__icon ops-metric__icon--violet"><Truck size={16} /></span>
          <div><span>Interventions</span><strong>{loading ? '—' : interventionCount}</strong></div>
          <small>Missions géolocalisées</small>
        </article>
        <article className={`ops-metric ${unlocatedCount > 0 ? 'ops-metric--attention' : ''}`}>
          <span className="ops-metric__icon ops-metric__icon--red"><Crosshair size={16} /></span>
          <div><span>Sans coordonnées</span><strong>{loading ? '—' : unlocatedCount}</strong></div>
          <small>Repère textuel</small>
        </article>
      </div>

      <div className="ops-workspace">
        <div className="ops-map-panel">
          <div className="ops-map-panel__toolbar">
            <div className="ops-map-panel__title"><MapPin size={15} /> CARTE TERRAIN <span>· {mapPoints.length}</span></div>
            <div className="ops-map-filters" role="group" aria-label="Afficher ou masquer les couches cartographiques">
              {pointTypes.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={visibleLayers[item] ? `is-active ops-map-layer ops-map-layer--${item.toLowerCase()}` : 'ops-map-layer'}
                  aria-pressed={visibleLayers[item]}
                  onClick={() => setVisibleLayers((current) => ({ ...current, [item]: !current[item] }))}
                >
                  {pointTypeLabels[item]}
                </button>
              ))}
            </div>
            <span className="ops-map-location"><MapPin size={14} /> Dakar, Sénégal</span>
          </div>
          <div className="ops-map-canvas">
            <MapContainer
              center={dakarCenter}
              zoom={13}
              scrollWheelZoom
              zoomControl
              className="ops-leaflet-map"
            >
              <FlyToSelectedPoint point={selectedPoint} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {mapPoints.map((point) => {
                const latitude = Number(point.latitude);
                const longitude = Number(point.longitude);
                if (
                  !Number.isFinite(latitude) ||
                  !Number.isFinite(longitude) ||
                  latitude < -90 ||
                  latitude > 90 ||
                  longitude < -180 ||
                  longitude > 180
                ) return null;

                return (
                  <Marker
                    key={`${point.typeObjet}-${point.id}`}
                    position={[latitude, longitude]}
                    icon={markerIcons[point.typeObjet]}
                    eventHandlers={{
                      click: () => {
                        setFeedFilter(point.typeObjet);
                        setSelectedPoint(point);
                      },
                    }}
                  />
                );
              })}
            </MapContainer>
            <div className="ops-map-caption">
              <span><i className="ops-legend-dot ops-legend-dot--signalement" />Signalement</span>
              <span><i className="ops-legend-dot ops-legend-dot--dossier" />Dossier</span>
              <span><i className="ops-legend-dot ops-legend-dot--intervention" />Intervention</span>
            </div>
          </div>
        </div>

        <aside className="ops-feed" aria-label="Flux opérationnel">
          <div className="ops-feed__heading">
            <div>
              <div className="ops-eyebrow">OBJETS GÉOLOCALISÉS</div>
              <h2>Flux opérationnel</h2>
            </div>
            <span className="ops-feed__count">{filteredFeedPoints.length}</span>
          </div>

          <div className="ops-feed__tabs" role="group" aria-label="Filtrer le flux opérationnel">
            {(['TOUS', ...pointTypes] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={feedFilter === item ? 'is-active' : ''}
                aria-pressed={feedFilter === item}
                onClick={() => setFeedFilter(item)}
              >
                {item === 'TOUS' ? 'Tout' : pointTypeLabels[item]}
              </button>
            ))}
          </div>

          {selectedPoint ? (
            <div className="ops-inspector">
              <div className="ops-inspector__top">
                <span className={`ops-type-tag ops-type-tag--${selectedPoint.typeObjet.toLowerCase()}`}>
                  {selectedPoint.typeObjet === 'INTERVENTION' ? 'MISSION TERRAIN' : selectedPoint.typeObjet}
                </span>
                <button
                  type="button"
                  className="ops-close-button"
                  title="Fermer l’inspecteur"
                  aria-label="Fermer l’inspecteur"
                  onClick={() => setSelectedPoint(null)}
                >
                  <X size={15} />
                </button>
              </div>
              <strong className="ops-inspector__reference">{selectedPoint.reference}</strong>
              <p>{selectedPoint.description || 'Aucune description disponible.'}</p>
              <div className="ops-inspector__meta">
                <span>Statut</span><b>{statusLabel(selectedPoint.statut)}</b>
                <span>Priorité</span><b>{statusLabel(selectedPoint.priorite)}</b>
                <span>
                  {selectedPoint.typeObjet === 'INTERVENTION'
                    ? selectedPoint.dateDebut ? 'Débutée' : 'Affectée'
                    : 'Reçu'}
                </span>
                <b>
                  {formatDate(
                    selectedPoint.typeObjet === 'INTERVENTION'
                      ? selectedPoint.dateDebut || selectedPoint.dateCreation
                      : selectedPoint.dateCreation
                  )}
                </b>
                {selectedPoint.typeObjet === 'INTERVENTION' && (
                  <>
                    <span>Équipe</span><b>{selectedPoint.nomEquipe || 'Non renseignée'}</b>
                    <span>Dossier</span><b>{selectedPoint.referenceDossier || 'Non renseigné'}</b>
                    {selectedPoint.dateFin && (
                      <><span>Terminée</span><b>{formatDate(selectedPoint.dateFin)}</b></>
                    )}
                    {selectedPoint.resultatIntervention && (
                      <><span>Résultat</span><b>{statusLabel(selectedPoint.resultatIntervention)}</b></>
                    )}
                  </>
                )}
              </div>
              {selectedPoint.typeObjet === 'INTERVENTION' && selectedPoint.statut === 'TERMINEE' && canVerify && (
                <Link to="/verifications" className="ops-inspector__action">
                  Examiner dans Contrôle &amp; clôture <ArrowUpRight size={13} />
                </Link>
              )}
            </div>
          ) : (
            <div className="ops-feed__hint"><MapPin size={14} /> Sélectionnez un point de la carte ou du flux.</div>
          )}

          <div className="ops-feed__list">
            {loading ? (
              <div className="ops-feed__empty"><RefreshCw size={16} className="ops-spin" /> Chargement des données…</div>
            ) : error ? (
              <div className="ops-feed__empty">Le flux est indisponible.</div>
            ) : filteredFeedPoints.length === 0 ? (
              <div className="ops-feed__empty">
                <Layers3 size={19} />
                <strong>
                  {feedFilter === 'INTERVENTION'
                    ? 'Aucune mission terrain géolocalisée'
                    : 'Aucun point à afficher'}
                </strong>
                <span>
                  {feedFilter === 'INTERVENTION'
                    ? 'Les missions sont placées sur la carte grâce aux coordonnées du dossier associé.'
                    : 'Les prochaines opérations de ce type apparaîtront ici.'}
                </span>
              </div>
            ) : (
              filteredFeedPoints.map((point) => (
                <button
                  type="button"
                  key={`${point.typeObjet}-${point.id}`}
                  className={`ops-feed-item ${selectedPoint?.id === point.id && selectedPoint.typeObjet === point.typeObjet ? 'is-selected' : ''}`}
                  onClick={() => {
                    setVisibleLayers((current) => ({ ...current, [point.typeObjet]: true }));
                    setSelectedPoint(point);
                  }}
                >
                  <span className={`ops-feed-item__marker ops-feed-item__marker--${point.typeObjet.toLowerCase()}`} />
                  <span className="ops-feed-item__content">
                    <span className="ops-feed-item__meta">
                      <b>{point.reference}</b><time>{formatDate(point.dateCreation)}</time>
                    </span>
                    <span className="ops-feed-item__description">
                      {point.typeObjet === 'INTERVENTION' && point.nomEquipe ? `${point.nomEquipe} · ` : ''}
                      {point.description || 'Description non renseignée'}
                    </span>
                    <span className="ops-feed-item__status">{statusLabel(point.statut)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};
