import React, { useMemo, useState } from 'react';
import Breadcrumbs from '../../components/common/Breadcrumbs';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Alert from '../../components/common/Alert';
import LiveDataNotice from '../../components/common/LiveDataNotice';
import BlindSpotsMap from '../../components/map/BlindSpotsMap';
import { useReports } from '../../hooks/useReports';
import { useAuth } from '../../hooks/useAuth';
import { MOCK_EXPERIENCE_SPOTS, getCoordinatesForReport } from '../../lib/mapGeo';
import {
  EyeOff,
  Sun,
  Moon,
  ShieldAlert,
  Flame,
  Accessibility,
  Footprints,
  CheckCircle2,
  ThumbsUp,
  MapPin
} from 'lucide-react';

const AUDIT_CATEGORY_MAP = {
  lighting: { categoryName: 'Streetlight Issues', subcategory: 'Poorly Lit Streets' },
  ramp: { categoryName: 'Footpath and Accessibility', subcategory: 'Missing Accessibility Ramps' },
  footpath: { categoryName: 'Footpath and Accessibility', subcategory: 'Missing Footpaths' },
  unsafe: { categoryName: 'Public Safety', subcategory: 'Unsafe Deserted Corridor' }
};

export const BlindSpotsPage = () => {
  const { user } = useAuth();
  const { reports, blindSpotClusters, submitReport, verifyTicket, isMockMode, isLoading, apiError, refreshData } = useReports();

  const [viewMode, setViewMode] = useState('night'); // 'day' | 'night'
  const [auditCategory, setAuditCategory] = useState('lighting');
  const [ward, setWard] = useState('Ward 22 (North Zone)');
  const [spotTitle, setSpotTitle] = useState('');
  const [spotLocation, setSpotLocation] = useState('Sector 4 Link Road, Ward 22');
  const [illuminationRating, setIlluminationRating] = useState(1);
  const [riskDescription, setRiskDescription] = useState(
    'Seven non-functional sodium lamps leave entire corridor dark. Women commuters returning from metro station are forced to walk on road.'
  );
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [pickMode, setPickMode] = useState(false);

  const [selectedCluster, setSelectedCluster] = useState(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [auditSuccess, setAuditSuccess] = useState('');
  const [votingId, setVotingId] = useState('');
  const [voteError, setVoteError] = useState('');
  const [mockVotedSpots, setMockVotedSpots] = useState(() => new Set());

  // Mock Blind Spot Clusters for rich demonstration alongside live experience reports
  const mockClusters = useMemo(
    () => [
      {
        id: 'CLUSTER-BLIND-01',
        title: 'Sector 4 Link Road Dark Stretch',
        ward: 'Ward 22 (North Zone)',
        type: 'Zero Street Illumination & Deserted Walkway',
        dayRating: 'Safe & Clear (Visibility: Good)',
        nightRating: 'Dangerous Pitch Black (Zero Light)',
        escalationStatus: 'Auto-Escalated to Zonal Safety Committee',
        reportsCount: 7,
        missingInfra: '7 Non-functional light poles, overgrown tree canopy'
      },
      {
        id: 'CLUSTER-BLIND-02',
        title: 'Central Bus Terminal South Gate Curb',
        ward: 'Ward 03 (Central Zone)',
        type: 'Missing Wheelchair Ramp & High Curb Stone (8 Inches)',
        dayRating: 'Heavy Footfall / High Barrier',
        nightRating: 'Fall Hazard due to poor curb markings',
        escalationStatus: 'Escalated to Accessibility Cell',
        reportsCount: 5,
        missingInfra: 'Drop curb ramp, broken tactile paving blocks'
      },
      {
        id: 'CLUSTER-BLIND-03',
        title: 'Old Canal Road Pedestrian Walkway',
        ward: 'Ward 14 (South Zone)',
        type: 'Missing Footpath Link & Blind Turn',
        dayRating: 'Mixed vehicular / pedestrian conflict',
        nightRating: 'Poorly Lit Curve with no sidewalk barrier',
        escalationStatus: 'Scheduled for Field Verification',
        reportsCount: 3,
        missingInfra: 'Continuous sidewalk, sodium vapor lamp upgrade'
      }
    ],
    []
  );

  const liveSpots = useMemo(() => {
    const liveExp = (reports || []).filter((r) => r.type === 'experience');
    const pool = isMockMode ? [...liveExp, ...MOCK_EXPERIENCE_SPOTS] : liveExp;
    return pool.map((spot) => ({
      ...spot,
      hasMapCoords: Boolean(getCoordinatesForReport(spot, isMockMode))
    }));
  }, [reports, isMockMode]);

  const pickedLocation =
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    latitude !== '' &&
    longitude !== ''
      ? { latitude: Number(latitude), longitude: Number(longitude) }
      : null;

  const handlePickLocation = (coords) => {
    setLatitude(String(coords.latitude));
    setLongitude(String(coords.longitude));
    setPickMode(false);
  };

  const handleSimulateSubmit = async (e) => {
    e.preventDefault();
    if (submitBusy) return;

    const mappedCat = AUDIT_CATEGORY_MAP[auditCategory] || AUDIT_CATEGORY_MAP.unsafe;
    const trimmedTitle = spotTitle.trim() || `${mappedCat.subcategory} near ${spotLocation.trim()}`;
    const trimmedDesc = `${riskDescription.trim()} [Illumination Score: ${illuminationRating}/5 | Mode: ${viewMode === 'night' ? 'Night' : 'Day'}]`;

    setSubmitBusy(true);
    setSubmitError('');
    setAuditSuccess('');

    try {
      const created = await submitReport({
        category: auditCategory === 'lighting' ? 'lighting' : auditCategory === 'unsafe' ? 'public_safety' : 'accessibility',
        categoryName: mappedCat.categoryName,
        subcategory: mappedCat.subcategory,
        title: trimmedTitle,
        description: trimmedDesc,
        ward,
        location: spotLocation.trim(),
        landmark: spotLocation.trim(),
        severity: illuminationRating <= 2 ? 'High' : 'Medium',
        type: 'experience',
        timeOfDay: viewMode === 'night' ? 'Night' : 'Day',
        ...(pickedLocation ? pickedLocation : {})
      });

      setAuditSuccess(
        pickedLocation
          ? `Hazard recorded (${created?.report?.id || created?.ticketNumber}) and plotted on the Blind-Spot Grid.`
          : `Hazard recorded (${created?.report?.id || created?.ticketNumber}) in the audit feed. No GPS coordinates were provided, so it is not plotted on the map.`
      );
      setSpotTitle('');
    } catch (err) {
      setSubmitError(err?.message || 'Unable to submit blind-spot audit.');
    } finally {
      setSubmitBusy(false);
    }
  };

  const handleVoteSpot = async (reportId, { fromMap = false } = {}) => {
    setVoteError('');
    setVotingId(reportId);
    try {
      await verifyTicket(reportId, user?.id);
      if (isMockMode) {
        setMockVotedSpots((prev) => new Set(prev).add(reportId));
      }
    } catch (err) {
      if (!fromMap) {
        setVoteError(err?.message || 'Unable to vote on blind spot.');
      }
      throw err;
    } finally {
      setVotingId('');
    }
  };

  const displayClusters = isMockMode ? mockClusters : blindSpotClusters;

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Citizen Services', to: '/services' }, { label: 'Blind Spots Initiative' }]} />

      <div className="portal-container" style={{ paddingTop: '2rem' }}>
        {/* Scope Notice */}
        <Alert type="info" title="Module B: Blind Spots – Urban Pedestrian Safety Audit">
          Focuses on invisible civic hazards: unlit night stretches, missing sidewalks, and wheelchair inaccessible infrastructure. Multi-report clusters automatically trigger safety escalations.
        </Alert>

        <div style={{ marginTop: '1.25rem' }}>
          <LiveDataNotice
            isMockMode={isMockMode}
            isLoading={isLoading}
            apiError={apiError}
            onRetry={refreshData}
            resourceLabel="blind spots and civic report markers"
          />
        </div>

        {/* Header Hero Banner */}
        <div
          style={{
            backgroundColor: viewMode === 'night' ? '#07182C' : '#F8FAFC',
            color: viewMode === 'night' ? '#FFFFFF' : 'var(--color-primary-navy)',
            border: '1px solid var(--color-border)',
            borderLeft: '5px solid var(--color-gold)',
            padding: '1.75rem',
            borderRadius: '2px',
            marginBottom: '2rem',
            transition: 'background-color 0.3s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <EyeOff size={24} color="var(--color-gold)" />
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', margin: 0, color: 'inherit' }}>
                  Blind Spots &amp; Public Safety Auditing
                </h2>
              </div>
              <p style={{ fontSize: '0.9375rem', color: viewMode === 'night' ? '#CBD5E1' : 'var(--color-text-secondary)', marginTop: '0.5rem', maxWidth: '720px' }}>
                A civic safety framework tracking conditions that change dramatically by time of day. Document poorly lit paths, missing ramps, and pedestrian hazards to trigger automated cluster escalation.
              </p>
            </div>

            {/* Day / Night Visualization Toggle */}
            <div
              style={{
                backgroundColor: viewMode === 'night' ? '#0F294D' : '#E2E8F0',
                padding: '4px',
                borderRadius: '3px',
                display: 'flex',
                gap: '4px'
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('day')}
                aria-pressed={viewMode === 'day'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: viewMode === 'day' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'day' ? 'var(--color-primary-navy)' : '#64748B',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '2px',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Sun size={14} color="#D97706" />
                <span>Day Mode Audit</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('night')}
                aria-pressed={viewMode === 'night'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: viewMode === 'night' ? 'var(--color-gold)' : 'transparent',
                  color: viewMode === 'night' ? 'var(--color-primary-navy)' : '#94A3B8',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '2px',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Moon size={14} />
                <span>Night Mode Audit (Active)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 Pillars of Blind Spot Audits */}
        <div className="grid-4" style={{ gap: '1rem', marginBottom: '2.5rem' }}>
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid var(--color-border)', borderTop: '3px solid var(--color-alert-red)', padding: '1.25rem', borderRadius: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <EyeOff size={18} color="var(--color-alert-red)" />
              <strong style={{ fontSize: '0.9375rem', color: 'var(--color-primary-navy)' }}>Unlit Corridors</strong>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              Streets where streetlight failure or sparse pole distribution creates pitch-dark zones after 19:00 hrs.
            </p>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid var(--color-border)', borderTop: '3px solid var(--color-gold)', padding: '1.25rem', borderRadius: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Accessibility size={18} color="#B88E3E" />
              <strong style={{ fontSize: '0.9375rem', color: 'var(--color-primary-navy)' }}>Missing Ramps</strong>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              Curbs, bus stops, and public buildings lacking smooth ramps for wheelchair users and stroller access.
            </p>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid var(--color-border)', borderTop: '3px solid var(--color-gov-blue)', padding: '1.25rem', borderRadius: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Footprints size={18} color="var(--color-gov-blue)" />
              <strong style={{ fontSize: '0.9375rem', color: 'var(--color-primary-navy)' }}>Broken Footpaths</strong>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              Abrupt sidewalk ends forcing pedestrians into fast-moving traffic lanes, especially near blind curves.
            </p>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid var(--color-border)', borderTop: '3px solid var(--color-success-green)', padding: '1.25rem', borderRadius: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Flame size={18} color="var(--color-success-green)" />
              <strong style={{ fontSize: '0.9375rem', color: 'var(--color-primary-navy)' }}>Cluster Escalation</strong>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              When 3 or more citizens tag adjacent hazards, the system creates a high-priority Municipal Intervention Cluster.
            </p>
          </div>
        </div>

        {/* Interactive Geospatial Map, Report Clustering & Blind-Spot Grid */}
        <BlindSpotsMap
          reports={reports}
          isMockMode={isMockMode}
          currentUser={user}
          externalVotedIds={mockVotedSpots}
          onVoteSpot={(id) => handleVoteSpot(id, { fromMap: true })}
          pickMode={pickMode}
          onTogglePickMode={() => setPickMode((p) => !p)}
          pickedLocation={pickedLocation}
          onPickLocation={handlePickLocation}
        />

        {/* Interactive Hazard Submission & Active Clusters */}
        <div className="grid-2" style={{ gap: '2rem', marginBottom: '2.5rem' }}>
          {/* Left: Tag a Blind Spot Form */}
          <Card>
            <Card.Header variant="navy">
              <Card.Title icon={ShieldAlert}>Tag a Public Blind Spot</Card.Title>
            </Card.Header>
            <Card.Body>
              {submitError && (
                <div style={{ marginBottom: '1rem' }}>
                  <Alert type="danger" title="Submission Failed">
                    {submitError}
                  </Alert>
                </div>
              )}

              {auditSuccess && (
                <div style={{ marginBottom: '1rem' }}>
                  <Alert type="success" title="Hazard Recorded in Safety Audit Pool">
                    {auditSuccess}
                  </Alert>
                </div>
              )}

              <form onSubmit={handleSimulateSubmit}>
                <div className="form-group">
                  <label className="form-label">Blind Spot Classification</label>
                  <select
                    className="form-control"
                    value={auditCategory}
                    onChange={(e) => setAuditCategory(e.target.value)}
                  >
                    <option value="lighting">Dark Stretch / Streetlight Failure</option>
                    <option value="ramp">Missing Wheelchair Ramp / Broken Tactile</option>
                    <option value="footpath">Missing Sidewalk / Pedestrian Conflict</option>
                    <option value="unsafe">Unsafe Deserted Corner / Overgrown Brush</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Short Title</label>
                  <input
                    type="text"
                    className="form-control"
                    value={spotTitle}
                    onChange={(e) => setSpotTitle(e.target.value)}
                    placeholder="e.g. Unlit bus stop stretch near Sector 4"
                  />
                </div>

                <div className="grid-2" style={{ gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Ward <span className="required">*</span></label>
                    <select
                      className="form-control"
                      value={ward}
                      onChange={(e) => setWard(e.target.value)}
                      required
                    >
                      <option value="Ward 22 (North Zone)">Ward 22 (North Zone)</option>
                      <option value="Ward 14 (South Zone)">Ward 14 (South Zone)</option>
                      <option value="Ward 08 (Central Zone)">Ward 08 (Central Zone)</option>
                      <option value="Ward 03 (Central Zone)">Ward 03 (Central Zone)</option>
                      <option value="Ward 11 (West Zone)">Ward 11 (West Zone)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Location / Landmark <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={spotLocation}
                      onChange={(e) => setSpotLocation(e.target.value)}
                      placeholder="Enter street name or landmark"
                      required
                    />
                  </div>
                </div>

                <div className="grid-2" style={{ gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Latitude (optional)</label>
                    <input
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      className="form-control"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder="12.9716 (or pin map)"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Longitude (optional)</label>
                    <input
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      className="form-control"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder="77.5946 (or pin map)"
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '0.9rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPickMode((p) => !p)}
                  >
                    <MapPin size={13} />
                    <span>{pickMode ? 'Cancel Map Pinning' : 'Pick Coordinates from Map Above'}</span>
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Time-of-Day Illumination Score: <strong>{illuminationRating} / 5</strong> ({illuminationRating === 1 ? 'Pitch Black' : illuminationRating <= 3 ? 'Dim / Unsafe' : 'Well Lit'})
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={illuminationRating}
                    onChange={(e) => setIlluminationRating(Number(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                    <span>1: Pitch Black (Extreme Risk)</span>
                    <span>3: Moderate Lighting</span>
                    <span>5: Fully Lit &amp; Visible</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Specific Pedestrian Risk <span className="required">*</span></label>
                  <textarea
                    rows={3}
                    className="form-control"
                    placeholder="e.g. Broken pavement edge, zero lighting between bus stop and residential gate..."
                    value={riskDescription}
                    onChange={(e) => setRiskDescription(e.target.value)}
                    required
                  />
                </div>

                <Button variant="gold" type="submit" icon={CheckCircle2} disabled={submitBusy}>
                  {submitBusy
                    ? 'Submitting Audit...'
                    : isMockMode
                      ? 'Submit Audit Observation (Demo)'
                      : 'Submit Audit Observation'}
                </Button>
              </form>
            </Card.Body>
          </Card>

          {/* Right: Tagged Blind Spots (Citizen Voting) + Escalated Clusters */}
          <div>
            <div className="section-heading" style={{ fontSize: '1.125rem' }}>
              <span>Citizen-Tagged Blind Spots &amp; Clusters</span>
              <Badge variant="escalated">Live Municipal Feed</Badge>
            </div>

            {voteError && (
              <div style={{ marginBottom: '0.75rem' }}>
                <Alert type="danger">{voteError}</Alert>
              </div>
            )}

            {liveSpots.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {liveSpots.slice(0, 6).map((spot) => {
                  const spotKey = spot.reportId || spot.id;
                  const alreadyInVerifiedBy = Boolean(
                    user?.id && Array.isArray(spot.verifiedBy) && spot.verifiedBy.includes(user.id)
                  );
                  const hasVoted = alreadyInVerifiedBy || mockVotedSpots.has(spotKey);
                  const displayedVotes =
                    (spot.verifiedCount ?? 0) + (!alreadyInVerifiedBy && mockVotedSpots.has(spotKey) ? 1 : 0);
                  return (
                    <div
                      key={spotKey}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--color-border)',
                        borderLeft: '4px solid var(--color-gold)',
                        padding: '0.85rem 1rem',
                        borderRadius: '2px',
                        boxShadow: 'var(--shadow-subtle)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--color-primary-navy)', fontSize: '0.9rem' }}>
                            {spot.title}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                            {spot.wardNumber} • {spot.category}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {!spot.hasMapCoords && (
                            <Badge variant="pending">Unmapped (No GPS)</Badge>
                          )}
                          <Badge variant="navy">{displayedVotes} Votes</Badge>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {spot.timeOfDay ? `Peak Risk: ${spot.timeOfDay}` : spot.location}
                        </span>
                        <Button
                          variant={hasVoted ? 'success' : 'secondary'}
                          size="sm"
                          icon={hasVoted ? CheckCircle2 : ThumbsUp}
                          disabled={hasVoted || votingId === spotKey || !user?.id || user?.role !== 'citizen'}
                          onClick={() => handleVoteSpot(spotKey).catch(() => {})}
                        >
                          {hasVoted
                            ? isMockMode && String(spotKey).startsWith('REP-EXP-')
                              ? 'Endorsed (Demo)'
                              : 'Endorsed'
                            : !user?.id || user?.role !== 'citizen'
                              ? 'Citizen Login Required'
                              : votingId === spotKey
                                ? 'Voting...'
                                : 'I See This Too'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
              Clusters formed automatically by spatial grouping of citizen reports. These are prioritized in the Municipal Commissioner&apos;s Safety Dashboard.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {!isMockMode && isLoading && liveSpots.length === 0 && displayClusters.length === 0 ? (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--color-border)',
                    padding: '1.25rem',
                    borderRadius: '2px',
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.8125rem'
                  }}
                >
                  Loading blind-spot feed from CivicReflex backend...
                </div>
              ) : !isMockMode && apiError && liveSpots.length === 0 && displayClusters.length === 0 ? (
                <div
                  style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid var(--color-alert-border)',
                    padding: '1.25rem',
                    borderRadius: '2px',
                    color: '#991B1B',
                    fontSize: '0.8125rem'
                  }}
                >
                  Unable to load blind-spot audits and clusters while the backend connection is unavailable. Use Retry Connection above.
                </div>
              ) : displayClusters.length === 0 ? (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--color-border)',
                    padding: '1.25rem',
                    borderRadius: '2px',
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.8125rem'
                  }}
                >
                  No escalated blind-spot clusters recorded yet. Citizen-submitted blind spots with GPS coordinates appear on the map grid above.
                </div>
              ) : (
                displayClusters.map((cluster) => (
                <div
                  key={cluster.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--color-border)',
                    borderLeft: '4px solid var(--color-alert-red)',
                    padding: '1rem',
                    borderRadius: '2px',
                    boxShadow: 'var(--shadow-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--color-primary-navy)', fontSize: '0.9375rem' }}>
                        {cluster.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        {cluster.ward} • {cluster.missingInfra || cluster.category}
                      </div>
                    </div>
                    <Badge variant="escalated">{cluster.reportsCount} Reports</Badge>
                  </div>

                  {cluster.dayRating && (
                    <div
                      style={{
                        backgroundColor: '#F8FAFC',
                        padding: '0.5rem',
                        borderRadius: '2px',
                        fontSize: '0.75rem',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '0.5rem',
                        margin: '0.5rem 0'
                      }}
                    >
                      <div>
                        <span style={{ color: '#D97706', fontWeight: 600 }}>Day Assessment:</span>
                        <div>{cluster.dayRating}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-alert-red)', fontWeight: 600 }}>Night Assessment:</span>
                        <div>{cluster.nightRating}</div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-gov-blue)', fontWeight: 600 }}>
                      › {cluster.escalationStatus || cluster.approvalStatus}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedCluster(cluster)}
                      className="btn btn-secondary btn-sm"
                    >
                      Audit Details
                    </button>
                  </div>
                </div>
              ))
              )}
            </div>
          </div>
        </div>

        {/* Selected Cluster Details Modal / Preview */}
        {selectedCluster && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '2px solid var(--color-gold)',
              padding: '1.25rem',
              borderRadius: '2px',
              marginBottom: '2rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', margin: 0, color: 'var(--color-primary-navy)' }}>
                {selectedCluster.title} – Detailed Inspection File
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCluster(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}
              >
                &times; Close
              </button>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              <strong>Hazard Diagnostics:</strong> {selectedCluster.type || selectedCluster.details}. Co-ordinates mapped for emergency sodium lamp replacement and pedestrian railing installation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlindSpotsPage;
