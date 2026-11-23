import React, { useState } from 'react';
import { MapPin } from 'lucide-react';

export const LocationPicker = ({ value, onChange }) => {
  const [status, setStatus] = useState('');

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatus('Location is not supported here. Enter it manually.');
      return;
    }
    setStatus('Getting your location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        });
        setStatus('Location captured.');
      },
      () => setStatus('Could not get your location. Allow access or enter it manually.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div>
      <button
        type="button"
        onClick={useCurrentLocation}
        className="btn btn-secondary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
      >
        <MapPin size={16} aria-hidden="true" /> Use my current location
      </button>
      {status && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }} role="status">
          {status}
        </p>
      )}

      <div className="grid-2" style={{ gap: '1rem', marginTop: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="lat-input">Latitude</label>
          <input
            id="lat-input"
            type="text"
            className="form-control"
            value={value.lat}
            onChange={(e) => onChange({ ...value, lat: e.target.value })}
            placeholder="e.g. 12.9716"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="lng-input">Longitude</label>
          <input
            id="lng-input"
            type="text"
            className="form-control"
            value={value.lng}
            onChange={(e) => onChange({ ...value, lng: e.target.value })}
            placeholder="e.g. 77.5946"
          />
        </div>
      </div>
    </div>
  );
};