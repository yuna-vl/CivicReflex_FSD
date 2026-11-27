import React, { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { DEFAULT_MAP_CENTER, WARD_COORDINATES } from '../../lib/mapGeo';
import { extractWardLabel } from '../../lib/normalizers';

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#003366;border:3px solid #CDA250;box-shadow:0 0 6px rgba(0,0,0,0.45)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

function ClickHandler({ onPick }) {
  useMapEvents({
    click: (e) => {
      onPick({
        latitude: Number(e.latlng.lat.toFixed(6)),
        longitude: Number(e.latlng.lng.toFixed(6))
      });
    }
  });
  return null;
}

function MapCenterSync({ center }) {
  const map = useMap();
  const lat = center[0];
  const lng = center[1];

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const current = map.getCenter();
    if (Math.abs(current.lat - lat) > 1e-6 || Math.abs(current.lng - lng) > 1e-6) {
      map.setView([lat, lng], map.getZoom(), { animate: true });
    }
  }, [map, lat, lng]);

  return null;
}

export const CoordinatePicker = ({ latitude, longitude, ward, onChange }) => {
  const wardKey = extractWardLabel(ward);
  const wardCenter = WARD_COORDINATES[wardKey] || DEFAULT_MAP_CENTER;
  const hasCoords =
    latitude !== '' &&
    longitude !== '' &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude));

  const center = hasCoords ? [Number(latitude), Number(longitude)] : wardCenter;

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div
        style={{
          height: '220px',
          width: '100%',
          border: '1px solid var(--color-border)',
          borderRadius: '2px',
          overflow: 'hidden',
          cursor: 'crosshair'
        }}
      >
        <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={onChange} />
          <MapCenterSync center={center} />
          {hasCoords && <Marker position={[Number(latitude), Number(longitude)]} icon={pinIcon} />}
        </MapContainer>
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
        Click anywhere on the map to pin the exact grievance location.
      </div>
    </div>
  );
};

export default CoordinatePicker;
