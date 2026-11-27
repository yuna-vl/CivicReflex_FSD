import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import Supercluster from 'supercluster';
import 'leaflet/dist/leaflet.css';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Rectangle,
  useMap,
  useMapEvents
} from 'react-leaflet';
import Badge from '../common/Badge';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  buildBlindSpotGrid,
  buildReportGeoFeatures,
  statusPinColor
} from '../../lib/mapGeo';

const pinIcon = (status) =>
  L.divIcon({
    className: '',
    html: `<div style="width:15px;height:15px;border-radius:50%;background:${statusPinColor(status)};border:2px solid #FFFFFF;box-shadow:0 0 4px rgba(11,37,69,0.55)"></div>`,
    iconSize: [15, 15]
  });

const clusterIcon = (count) => {
  const size = count < 10 ? 34 : count < 50 ? 42 : 50;
  const bg = count < 10 ? '#003366' : count < 50 ? '#B7791F' : '#B30000';
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:#FFFFFF;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;border:3px solid #FFFFFF;box-shadow:0 0 0 3px rgba(11,37,69,0.22)">${count}</div>`,
    iconSize: [size, size]
  });
};

const blindSpotStarIcon = L.divIcon({
  className: '',
  html: '<div style="width:20px;height:20px;line-height:20px;text-align:center;font-size:15px;color:#CDA250;background:#0B2545;border:2px solid #FFFFFF;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.45)">★</div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

const draftPinIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#B30000;border:3px solid #CDA250;box-shadow:0 0 6px rgba(0,0,0,0.5)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

const cellColor = (score) =>
  score >= 10 ? '#B30000' : score >= 5 ? '#D97706' : score >= 2 ? '#CDA250' : '#003366';

function MapBoundsSync({ points, fitTrigger }) {
  const map = useMap();
  const hasAutoFittedRef = useRef(false);
  const lastFitTriggerRef = useRef(fitTrigger);

  useEffect(() => {
    const triggerRequested = fitTrigger !== lastFitTriggerRef.current;
    if (!points.length) return;
    if (hasAutoFittedRef.current && !triggerRequested) return;

    hasAutoFittedRef.current = true;
    lastFitTriggerRef.current = fitTrigger;

    if (points.length === 1) {
      map.setView(points[0], 14, { animate: triggerRequested });
      return;
    }

    const bounds = L.latLngBounds(points);
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [36, 36],
        maxZoom: 14,
        animate: triggerRequested
      });
    }
  }, [map, points, fitTrigger]);

  return null;
}

function MapViewportWatcher({ onViewportChange, pickMode, onPickLocation }) {
  const map = useMap();

  const emitBounds = () => {
    const b = map.getBounds();
    onViewportChange({
      bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
      zoom: map.getZoom()
    });
  };

  useMapEvents({
    load: emitBounds,
    moveend: emitBounds,
    zoomend: emitBounds,
    click: (e) => {
      if (pickMode && onPickLocation) {
        onPickLocation({
          latitude: Number(e.latlng.lat.toFixed(6)),
          longitude: Number(e.latlng.lng.toFixed(6))
        });
      }
    }
  });

  return null;
}

function ReportClusterLayer({ features, viewport }) {
  const map = useMap();

  const index = useMemo(() => {
    const sc = new Supercluster({ radius: 60, maxZoom: 17 });
    sc.load(features);
    return sc;
  }, [features]);

  const clusters = useMemo(() => {
    if (!viewport?.bounds) return [];
    return index.getClusters(viewport.bounds, Math.round(viewport.zoom));
  }, [index, viewport]);

  return clusters.map((c) => {
    const [lng, lat] = c.geometry.coordinates;
    if (c.properties.cluster) {
      return (
        <Marker
          key={`cluster-${c.id}`}
          position={[lat, lng]}
          icon={clusterIcon(c.properties.point_count)}
          eventHandlers={{
            click: () =>
              map.flyTo([lat, lng], Math.min(index.getClusterExpansionZoom(c.id), 18))
          }}
        />
      );
    }

    const p = c.properties;
    return (
      <Marker key={`rep-${p.id}`} position={[lat, lng]} icon={pinIcon(p.status)}>
        <Popup>
          <div style={{ minWidth: '185px', fontSize: '0.8125rem' }}>
            <div style={{ fontWeight: 700, color: '#0B2545', marginBottom: '4px' }}>
              {p.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <Badge status={p.status} />
              <span style={{ fontSize: '0.75rem', color: '#4A5568' }}>{p.wardNumber}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '6px' }}>
              {p.category} • {p.verifiedCount} endorsements
            </div>
            {p.ticketNumber && (
              <Link
                to={`/track?ticket=${encodeURIComponent(p.ticketNumber)}`}
                style={{ fontWeight: 700, color: '#003366', textDecoration: 'underline' }}
              >
                Track {p.ticketNumber} →
              </Link>
            )}
          </div>
        </Popup>
      </Marker>
    );
  });
}

export const BlindSpotsMap = ({
  reports = [],
  isMockMode = true,
  currentUser = null,
  externalVotedIds = null,
  onVoteSpot,
  pickMode = false,
  onTogglePickMode,
  pickedLocation = null,
  onPickLocation
}) => {
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showReports, setShowReports] = useState(true);
  const [showBlindGrid, setShowBlindGrid] = useState(true);
  const [votingId, setVotingId] = useState('');
  const [voteFeedback, setVoteFeedback] = useState({ type: '', text: '' });
  const [localVotedIds, setLocalVotedIds] = useState(() => new Set());
  const [fitTrigger, setFitTrigger] = useState(0);

  const [viewport, setViewport] = useState({
    bounds: [
      DEFAULT_MAP_CENTER[1] - 0.12,
      DEFAULT_MAP_CENTER[0] - 0.12,
      DEFAULT_MAP_CENTER[1] + 0.12,
      DEFAULT_MAP_CENTER[0] + 0.12
    ],
    zoom: DEFAULT_MAP_ZOOM
  });

  const { features, unmappedCount } = useMemo(
    () =>
      buildReportGeoFeatures(reports, {
        isMockMode,
        statusFilter,
        categoryFilter
      }),
    [reports, isMockMode, statusFilter, categoryFilter]
  );

  const { spots, gridCells } = useMemo(() => {
    const combinedVoted = new Set([
      ...localVotedIds,
      ...(externalVotedIds ? Array.from(externalVotedIds) : [])
    ]);
    return buildBlindSpotGrid(reports, isMockMode, {
      statusFilter,
      categoryFilter,
      extraVotedIds: isMockMode ? combinedVoted : null,
      currentUserId: currentUser?.id || ''
    });
  }, [reports, isMockMode, statusFilter, categoryFilter, localVotedIds, externalVotedIds, currentUser?.id]);

  const allPoints = useMemo(() => {
    const pts = [];
    for (const f of features) {
      const coords = f?.geometry?.coordinates;
      if (
        Array.isArray(coords) &&
        coords.length === 2 &&
        Number.isFinite(coords[0]) &&
        Number.isFinite(coords[1])
      ) {
        pts.push([coords[1], coords[0]]);
      }
    }
    for (const s of spots) {
      const coords = s?.coordinates;
      if (
        Array.isArray(coords) &&
        coords.length === 2 &&
        Number.isFinite(coords[0]) &&
        Number.isFinite(coords[1])
      ) {
        pts.push([coords[1], coords[0]]);
      }
    }
    return pts;
  }, [features, spots]);

  const handleVote = async (spot) => {
    const targetId = spot.reportId || spot.id;
    if (!targetId || votingId) return;
    setVotingId(targetId);
    setVoteFeedback({ type: '', text: '' });
    try {
      if (onVoteSpot) {
        await onVoteSpot(targetId);
      }
      setLocalVotedIds((prev) => new Set(prev).add(targetId));
      setVoteFeedback({
        type: 'success',
        text: isMockMode
          ? `Endorsed "${spot.title}" (demo simulation).`
          : `Endorsed "${spot.title}".`
      });
    } catch (err) {
      setVoteFeedback({
        type: 'error',
        text: err?.message || 'Unable to record citizen vote.'
      });
    } finally {
      setVotingId('');
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--color-border)',
        borderTop: '4px solid var(--color-primary-navy)',
        borderRadius: '2px',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-card)',
        marginBottom: '2.5rem'
      }}
    >
      {/* Map Header & Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '0.9rem'
        }}
      >
        <div>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--color-primary-navy)', margin: 0 }}>
            Geospatial Grievance Clusters &amp; Blind-Spot Grid
          </h3>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            {features.length} mapped civic report(s) • {spots.length} blind-spot audit(s) • {gridCells.length} 165m micro-zone cell(s)
            {!isMockMode && unmappedCount > 0 ? ` (${unmappedCount} report(s) without GPS coordinates)` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            aria-label="Filter map reports by status"
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '145px', fontSize: '0.8125rem', padding: '0.35rem 0.6rem' }}
          >
            <option value="">All Statuses</option>
            <option value="Reported">Reported</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Citizen-Confirmed">Citizen-Confirmed</option>
            <option value="Escalated">Escalated</option>
          </select>

          <select
            aria-label="Filter map reports by category"
            className="form-control"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '155px', fontSize: '0.8125rem', padding: '0.35rem 0.6rem' }}
          >
            <option value="">All Categories</option>
            <option value="Road">Road Damage / Potholes</option>
            <option value="Garbage">Garbage &amp; Waste</option>
            <option value="Streetlight">Streetlight Issues</option>
            <option value="Drainage">Drainage &amp; Water</option>
            <option value="Footpath">Footpath &amp; Accessibility</option>
            <option value="Safety">Public Safety</option>
          </select>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showReports}
              onChange={(e) => setShowReports(e.target.checked)}
            />
            <span>Report Clusters</span>
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showBlindGrid}
              onChange={(e) => setShowBlindGrid(e.target.checked)}
            />
            <span>Blind-Spot Grid</span>
          </label>

          <button
            type="button"
            onClick={() => setFitTrigger((c) => c + 1)}
            disabled={allPoints.length === 0}
            className="btn btn-secondary btn-sm"
            title="Zoom map to show all mapped reports and blind spots"
          >
            Fit All Markers
          </button>

          {onTogglePickMode && (
            <button
              type="button"
              onClick={onTogglePickMode}
              className={pickMode ? 'btn btn-danger btn-sm' : 'btn btn-gold btn-sm'}
            >
              {pickMode ? 'Cancel Map Pin' : '+ Pin Blind Spot on Map'}
            </button>
          )}
        </div>
      </div>

      {pickMode && (
        <div
          style={{
            backgroundColor: '#FEF3C7',
            border: '1px solid #FDE68A',
            color: '#92400E',
            padding: '0.5rem 0.75rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            borderRadius: '2px',
            marginBottom: '0.75rem'
          }}
        >
          Click anywhere on the map below to populate latitude &amp; longitude in the &ldquo;Tag a Public Blind Spot&rdquo; form.
        </div>
      )}

      {voteFeedback.text && (
        <div
          style={{
            backgroundColor: voteFeedback.type === 'error' ? '#FEF2F2' : '#EFF8F2',
            border: `1px solid ${voteFeedback.type === 'error' ? '#F8B4B4' : '#A3D9B1'}`,
            color: voteFeedback.type === 'error' ? '#991B1B' : '#216E39',
            padding: '0.5rem 0.75rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            borderRadius: '2px',
            marginBottom: '0.75rem'
          }}
        >
          {voteFeedback.text}
        </div>
      )}

      <div
        style={{
          height: '440px',
          width: '100%',
          border: '1px solid var(--color-border)',
          borderRadius: '2px',
          overflow: 'hidden',
          cursor: pickMode ? 'crosshair' : 'grab'
        }}
      >
        <MapContainer
          center={DEFAULT_MAP_CENTER}
          zoom={DEFAULT_MAP_ZOOM}
          style={{ height: '100%', width: '100%' }}
          whenReady={(event) => {
            const b = event.target.getBounds();
            setViewport({
              bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
              zoom: event.target.getZoom()
            });
          }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapBoundsSync points={allPoints} fitTrigger={fitTrigger} />
          <MapViewportWatcher
            onViewportChange={setViewport}
            pickMode={pickMode}
            onPickLocation={onPickLocation}
          />

          {showReports && <ReportClusterLayer features={features} viewport={viewport} />}

          {showBlindGrid &&
            gridCells.map((cell) => {
              const fillOpacity = viewport.zoom >= 15 ? 0.28 : viewport.zoom >= 13 ? 0.2 : 0.14;
              return (
                <Rectangle
                  key={cell.cellKey}
                  bounds={[
                    [cell.bounds[1], cell.bounds[0]],
                    [cell.bounds[3], cell.bounds[2]]
                  ]}
                  pathOptions={{
                    color: cellColor(cell.score),
                    weight: 1.5,
                    opacity: 0.75,
                    fillColor: cellColor(cell.score),
                    fillOpacity
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: '0.8125rem', lineHeight: 1.45 }}>
                      <strong style={{ color: cellColor(cell.score) }}>
                        Blind-Spot Micro-Zone (Score: {Math.round(cell.score * 10) / 10})
                      </strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '4px' }}>
                        ~165m spatial grid cell
                      </div>
                      <div>• <strong>{cell.votes}</strong> citizen vote(s)</div>
                      <div>• <strong>{cell.spots}</strong> tagged blind spot(s)</div>
                      <div>• <strong>{cell.reports}</strong> official complaint(s) nearby</div>
                    </div>
                  </Popup>
                </Rectangle>
              );
            })}

          {showBlindGrid &&
            spots.map((spot) => {
              const [lng, lat] = spot.coordinates;
              const spotKey = spot.reportId || spot.id;
              const alreadyInVerifiedBy = Boolean(
                currentUser?.id && Array.isArray(spot.verifiedBy) && spot.verifiedBy.includes(currentUser.id)
              );
              const votedInUi = localVotedIds.has(spotKey) || Boolean(externalVotedIds?.has(spotKey));
              const hasVoted = alreadyInVerifiedBy || votedInUi;
              const displayedVotes =
                (spot.verifiedCount ?? 0) + (isMockMode && !alreadyInVerifiedBy && votedInUi ? 1 : 0);
              return (
                <Marker key={`bs-${spotKey}`} position={[lat, lng]} icon={blindSpotStarIcon}>
                  <Popup>
                    <div style={{ minWidth: '190px', fontSize: '0.8125rem' }}>
                      <strong style={{ color: '#0B2545', display: 'block', marginBottom: '3px' }}>
                        {spot.title}
                      </strong>
                      <div style={{ fontSize: '0.75rem', color: '#4A5568', marginBottom: '6px' }}>
                        {spot.category} • {spot.wardNumber} • <strong>{displayedVotes}</strong> verification(s)
                      </div>
                      {spot.description && (
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#64748B' }}>
                          {spot.description}
                        </p>
                      )}
                      {currentUser?.id && currentUser?.role === 'citizen' ? (
                        <button
                          type="button"
                          className={hasVoted ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
                          disabled={hasVoted || votingId === spotKey}
                          onClick={() => handleVote(spot)}
                        >
                          {hasVoted
                            ? 'Endorsed by You'
                            : votingId === spotKey
                              ? 'Recording...'
                              : 'I Observe This Hazard Too (+1)'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          Sign in with a citizen account to endorse this blind spot.
                        </span>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

          {pickedLocation && (
            <Marker position={[pickedLocation.latitude, pickedLocation.longitude]} icon={draftPinIcon}>
              <Popup>
                <div style={{ fontSize: '0.75rem' }}>
                  <strong>Selected Audit Pin</strong>
                  <div>
                    Lat: {pickedLocation.latitude}, Lng: {pickedLocation.longitude}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default BlindSpotsMap;
