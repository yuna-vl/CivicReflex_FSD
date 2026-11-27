import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Breadcrumbs from '../../components/common/Breadcrumbs';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Alert from '../../components/common/Alert';
import LiveDataNotice from '../../components/common/LiveDataNotice';
import { useReports } from '../../hooks/useReports';
import { useAuth } from '../../hooks/useAuth';
import {
  Search,
  CheckCircle2,
  ThumbsUp,
  LayoutDashboard,
  RotateCcw,
  Check,
  Camera,
  Clock,
  RefreshCw,
  Maximize2,
  X,
  Lock
} from 'lucide-react';

function EvidencePhotoCard({ label, badgeText, badgeBg, badgeColor, src, emptyTitle, emptySubtitle, onEnlarge }) {
  const [imgError, setImgError] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setImgError(false);
  }

  const hasValidImg = Boolean(src && !imgError);

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--color-border)',
        borderRadius: '2px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div
        style={{
          padding: '0.65rem 0.9rem',
          backgroundColor: '#F8FAFC',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary-navy)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {label}
        </span>
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '2px',
            backgroundColor: badgeBg,
            color: badgeColor
          }}
        >
          {badgeText}
        </span>
      </div>

      <div style={{ padding: '0.85rem', flex: 1 }}>
        {hasValidImg ? (
          <div style={{ position: 'relative' }}>
            <img
              src={src}
              alt={label}
              onError={() => setImgError(true)}
              style={{
                width: '100%',
                height: '220px',
                objectFit: 'cover',
                borderRadius: '2px',
                border: '1px solid var(--color-border)',
                display: 'block'
              }}
            />
            <button
              type="button"
              onClick={() => onEnlarge(src, label)}
              style={{
                position: 'absolute',
                right: '8px',
                bottom: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'rgba(11, 37, 69, 0.85)',
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '2px',
                padding: '4px 8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Maximize2 size={12} />
              <span>Enlarge</span>
            </button>
          </div>
        ) : (
          <div
            style={{
              height: '220px',
              backgroundColor: '#F8FAFC',
              border: '1px dashed var(--color-border-dark)',
              borderRadius: '2px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '1rem',
              color: 'var(--color-text-muted)'
            }}
          >
            {imgError ? (
              <Camera size={24} style={{ marginBottom: '0.5rem', color: 'var(--color-alert-red)' }} />
            ) : (
              <Clock size={24} style={{ marginBottom: '0.5rem' }} />
            )}
            <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--color-primary-navy)' }}>
              {imgError ? 'Photo Unavailable' : emptyTitle}
            </div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', maxWidth: '260px' }}>
              {imgError ? 'The uploaded image URL could not be loaded.' : emptySubtitle}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const TrackComplaintPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const ticketParam = searchParams.get('ticket') || '';

  const { user, role } = useAuth();
  const {
    isMockMode,
    isLoading,
    apiError,
    refreshData,
    reports,
    getTicket,
    getReport,
    fetchTicketDetails,
    verifyTicket,
    confirmCitizenResolution,
    reopenGrievance,
    userReports
  } = useReports();

  const firstLiveTicket = !isMockMode && !ticketParam ? (reports[0]?.ticketNumber || '') : '';
  const [inputTicket, setInputTicket] = useState(ticketParam || (isMockMode ? 'CR-2026-8842' : ''));
  const [inputDirty, setInputDirty] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState(ticketParam || (isMockMode ? 'CR-2026-8842' : ''));
  const resolvedActiveTicketId = activeTicketId || firstLiveTicket;
  const [errorMsg, setErrorMsg] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [fetchState, setFetchState] = useState({ key: '', error: '', bundle: null });

  const [disputeOpen, setDisputeOpen] = useState(false);
  const [citizenComment, setCitizenComment] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [lightbox, setLightbox] = useState(null);

  // Sync active ticket when URL parameter changes during render
  const [prevParam, setPrevParam] = useState(ticketParam);
  if (ticketParam !== prevParam) {
    setPrevParam(ticketParam);
    if (ticketParam) {
      setActiveTicketId(ticketParam);
      setInputTicket(ticketParam);
      setInputDirty(false);
      setErrorMsg('');
      setActionError('');
      setActionSuccess('');
      setDisputeOpen(false);
    }
  }

  const displayedInputTicket = inputDirty
    ? inputTicket
    : (inputTicket || (!activeTicketId ? firstLiveTicket : ''));

  const normalizedKey = resolvedActiveTicketId.trim().toUpperCase();
  const fetchLoading =
    manualLoading ||
    (!isMockMode && Boolean(normalizedKey) && fetchState.key !== normalizedKey);
  const fetchError =
    !isMockMode && fetchState.key === normalizedKey ? fetchState.error : '';
  const fetchedBundle =
    fetchState.key === normalizedKey ? fetchState.bundle : null;

  const loadTicket = async (targetId) => {
    const clean = String(targetId || '').trim().toUpperCase();
    if (!clean) return;
    setManualLoading(true);
    try {
      const result = await fetchTicketDetails(clean);
      if (result?.ticket) {
        setFetchState({ key: clean, error: '', bundle: result });
      } else {
        setFetchState({ key: clean, error: `No record found for "${clean}".`, bundle: null });
      }
    } catch (err) {
      setFetchState({
        key: clean,
        error: err?.message || `Unable to load ticket "${clean}".`,
        bundle: null
      });
    } finally {
      setManualLoading(false);
    }
  };

  useEffect(() => {
    if (!normalizedKey) return;
    let cancelled = false;

    const run = async () => {
      if (isMockMode) {
        const localT = getTicket(normalizedKey);
        const localR = getReport(normalizedKey);
        if (!cancelled) {
          setFetchState({
            key: normalizedKey,
            error: '',
            bundle: localT ? { ticket: localT, report: localR } : null
          });
        }
        return;
      }

      try {
        const result = await fetchTicketDetails(normalizedKey);
        if (!cancelled) {
          if (result?.ticket) {
            setFetchState({ key: normalizedKey, error: '', bundle: result });
          } else {
            setFetchState({
              key: normalizedKey,
              error: `No record found for "${normalizedKey}".`,
              bundle: null
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setFetchState({
            key: normalizedKey,
            error: err?.message || `Unable to load "${normalizedKey}".`,
            bundle: null
          });
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [normalizedKey, isMockMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = normalizedKey;
  const contextTicket = getTicket(query) || (isMockMode ? getTicket('CR-2026-8842') : null);
  const currentTicket =
    contextTicket && (!fetchedBundle?.ticket || fetchedBundle.ticket.ticketNumber === contextTicket.ticketNumber)
      ? contextTicket
      : fetchedBundle?.ticket || null;

  const linkedReport =
    (currentTicket ? getReport(currentTicket.ticketNumber) : null) ||
    fetchedBundle?.report ||
    null;

  const isVoted = Boolean(
    currentTicket?.verifiedByUser ||
      (user?.id && Array.isArray(linkedReport?.verifiedBy) && linkedReport.verifiedBy.includes(user.id))
  );

  const verificationVotes =
    linkedReport?.verifiedCount ?? (currentTicket?.verifiedByUser ? 1 : 0);

  const beforePhotoUrl =
    currentTicket?.inspection?.beforePhotoUrl ||
    currentTicket?.inspectionDetails?.beforePhotoUrl ||
    linkedReport?.beforePhotoUrl ||
    linkedReport?.photoUrl ||
    null;

  const afterPhotoUrl =
    currentTicket?.inspection?.afterPhotoUrl ||
    currentTicket?.inspectionDetails?.afterPhotoUrl ||
    linkedReport?.afterPhotoUrl ||
    null;

  const isCitizenActor = Boolean(user?.id && role === 'citizen');

  const handleSearch = async (e) => {
    e.preventDefault();
    const clean = displayedInputTicket.trim().toUpperCase();
    if (!clean) {
      setErrorMsg('Please enter a valid Ticket ID (e.g. CR-2026-9001) or Report ID (e.g. REP-2026-1001).');
      return;
    }

    setErrorMsg('');
    setActionError('');
    setActionSuccess('');
    setDisputeOpen(false);

    if (isMockMode) {
      const found = getTicket(clean) || getReport(clean);
      const resolvedTicketId = found?.ticketNumber || clean;
      if (found && getTicket(resolvedTicketId)) {
        setActiveTicketId(resolvedTicketId);
        setSearchParams({ ticket: resolvedTicketId });
      } else {
        setErrorMsg(`No record found for "${clean}". Displaying default audit record.`);
      }
      return;
    }

    setActiveTicketId(clean);
    setSearchParams({ ticket: clean });
    await loadTicket(clean);
  };

  const handleVerificationVote = async () => {
    if (!isCitizenActor) {
      setActionError('Please sign in with a citizen account to verify this report.');
      return;
    }
    if (isVoted || !currentTicket || actionBusy) return;
    setActionBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await verifyTicket(linkedReport?.id || currentTicket.ticketNumber, user?.id);
      if (!isMockMode) {
        await loadTicket(currentTicket.ticketNumber);
      }
      setActionSuccess('Community endorsement recorded in the municipal audit log.');
    } catch (err) {
      setActionError(err?.message || 'Unable to record verification vote.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmResolution = async () => {
    if (!currentTicket || actionBusy) return;
    setActionBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await confirmCitizenResolution(
        currentTicket.ticketNumber,
        citizenComment.trim() || 'Confirmed on site'
      );
      if (!isMockMode) {
        await loadTicket(currentTicket.ticketNumber);
      }
      setCitizenComment('');
      setActionSuccess('Resolution confirmed! Grievance is now formally Citizen-Confirmed.');
    } catch (err) {
      setActionError(err?.message || 'Unable to confirm resolution.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!currentTicket || actionBusy) return;
    const trimmed = disputeReason.trim();
    if (trimmed.length < 3) {
      setActionError('Please describe why the issue remains unresolved before reopening.');
      return;
    }

    setActionBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await reopenGrievance(currentTicket.ticketNumber, trimmed);
      if (!isMockMode) {
        await loadTicket(currentTicket.ticketNumber);
      }
      setDisputeOpen(false);
      setDisputeReason('');
      setActionSuccess('Grievance reopened and flagged for priority re-investigation.');
    } catch (err) {
      setActionError(err?.message || 'Unable to reopen grievance.');
    } finally {
      setActionBusy(false);
    }
  };

  const quickTickets = isMockMode ? userReports : (userReports.length > 0 ? userReports : reports.slice(0, 5));

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Citizen Services', to: '/services' }, { label: 'Track Complaint' }]} />

      <div className="portal-container" style={{ paddingTop: '2rem' }}>
        <div className="section-heading">
          <span>Grievance Lifecycle & Public Audit Trail</span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={() => loadTicket(resolvedActiveTicketId)}
              disabled={fetchLoading || !resolvedActiveTicketId}
            >
              {fetchLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={LayoutDashboard}
              onClick={() => navigate('/dashboard')}
            >
              My Dashboard
            </Button>
            <Badge variant="navy">{isMockMode ? 'Simulation Mode' : 'Live Redressal Engine'}</Badge>
          </div>
        </div>

        {/* Search Bar Strip */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--color-border)',
            padding: '1.25rem',
            borderRadius: '2px',
            boxShadow: 'var(--shadow-subtle)',
            marginBottom: '2rem'
          }}
        >
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 300px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Enter Ticket ID (e.g. CR-2026-9001) or Report ID (REP-2026-1001)"
                value={displayedInputTicket}
                onChange={(e) => {
                  setInputDirty(true);
                  setInputTicket(e.target.value);
                }}
                style={{ fontFamily: 'monospace', textTransform: 'uppercase', fontWeight: 700 }}
              />
            </div>
            <Button variant="primary" type="submit" icon={Search} disabled={fetchLoading}>
              {fetchLoading ? 'Searching...' : 'Search Audit Log'}
            </Button>
          </form>

          {quickTickets.length > 0 && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              <strong>Quick Select Grievance: </strong>
              {quickTickets.map((r, index) => (
                <React.Fragment key={r.ticketNumber || r.id}>
                  {index > 0 && <span> • </span>}
                  <button
                    type="button"
                    onClick={() => {
                      const target = r.ticketNumber || r.id;
                      setInputDirty(false);
                      setInputTicket(target);
                      setActiveTicketId(target);
                      setErrorMsg('');
                      setActionError('');
                      setActionSuccess('');
                      setSearchParams({ ticket: target });
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-gov-blue)',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontWeight: 700,
                      padding: 0
                    }}
                  >
                    {r.ticketNumber} ({r.subcategory || r.category}{r.isUserSubmitted ? ' - Just Filed' : ''})
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          {errorMsg && (
            <div style={{ marginTop: '1rem' }}>
              <Alert type="warning">{errorMsg}</Alert>
            </div>
          )}
          {fetchError && (
            <div style={{ marginTop: '1rem' }}>
              <Alert type="danger" title="Ticket Lookup Failed">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <span>{fetchError}</span>
                  {resolvedActiveTicketId && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={RefreshCw}
                      disabled={fetchLoading}
                      onClick={() => loadTicket(resolvedActiveTicketId)}
                    >
                      Retry Lookup
                    </Button>
                  )}
                </div>
              </Alert>
            </div>
          )}
        </div>

        <LiveDataNotice
          isMockMode={isMockMode}
          isLoading={isLoading && !currentTicket && !fetchLoading}
          apiError={!fetchError ? apiError : null}
          onRetry={refreshData}
          resourceLabel="complaint registry"
        />

        {fetchLoading && !currentTicket && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--color-border)',
              padding: '2.5rem',
              textAlign: 'center',
              borderRadius: '2px',
              marginBottom: '2rem',
              color: 'var(--color-text-secondary)'
            }}
          >
            Loading ticket audit trail from CivicReflex registry...
          </div>
        )}

        {!fetchLoading && !currentTicket && !fetchError && (isMockMode || (!isLoading && !apiError)) && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--color-border)',
              padding: '2.5rem',
              textAlign: 'center',
              borderRadius: '2px',
              marginBottom: '2rem',
              color: 'var(--color-text-secondary)'
            }}
          >
            Enter a Ticket ID (e.g., <code>CR-2026-9001</code>) or Report ID above to view its live resolution timeline and photographic evidence.
          </div>
        )}

        {/* Ticket Details & Timeline */}
        {currentTicket && (
          <div>
            {/* Header Summary Card */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--color-border)',
                borderTop: '4px solid var(--color-gov-blue)',
                padding: '1.5rem',
                borderRadius: '2px',
                boxShadow: 'var(--shadow-card)',
                marginBottom: '2rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-primary-navy)' }}>
                      {currentTicket.ticketNumber}
                    </span>
                    <Badge status={currentTicket.currentStatus} />
                    <span style={{ fontSize: '0.75rem', backgroundColor: '#FEF3C7', color: '#92400E', padding: '2px 8px', fontWeight: 700, borderRadius: '2px' }}>
                      {currentTicket.urgencyLevel}
                    </span>
                    {currentTicket.isUserSubmitted && (
                      <span className="badge badge-new">Submitted By You</span>
                    )}
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--color-primary-navy)', margin: '0.5rem 0 0.25rem 0' }}>
                    {currentTicket.subject}
                  </h3>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                    {currentTicket.address} • {currentTicket.ward}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Statutory Resolution SLA Target:</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-success-green)', marginTop: '2px' }}>
                    {currentTicket.expectedResolutionDate}
                  </div>
                </div>
              </div>

              {(currentTicket.description || linkedReport?.description) && (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', backgroundColor: '#FAFBFD', border: '1px solid var(--color-border-light)', padding: '0.75rem 1rem', borderRadius: '2px', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--color-primary-navy)' }}>Reported Defect Description: </strong>
                  {currentTicket.description || linkedReport?.description}
                </p>
              )}

              {/* Authority Nodal Box */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                  backgroundColor: '#F8FAFC',
                  padding: '1rem',
                  borderRadius: '2px',
                  border: '1px solid var(--color-border)'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    Assigned Field Officer
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--color-primary-navy)', marginTop: '2px' }}>
                    {currentTicket.assignedAuthority?.name || 'Awaiting Allocation'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    {currentTicket.assignedAuthority?.designation || 'Zonal Assignment Desk'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    Department Division
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--color-dark-slate)', marginTop: '2px' }}>
                    {currentTicket.assignedAuthority?.department || 'Unassigned'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-gov-blue)' }}>
                    {currentTicket.assignedAuthority?.contact || 'nodal-desk@civicreflex.gov.in'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    Citizen Verification Status
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--color-success-green)', marginTop: '2px' }}>
                    {verificationVotes} Ward Citizen Endorsements
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Minimum 3 votes needed for official sign-off
                  </div>
                </div>
              </div>
            </div>

            {/* Before / After Photographic Evidence */}
            <div style={{ marginBottom: '2.5rem' }}>
              <div className="section-heading">
                <span>Before &amp; After Photographic Evidence</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  Click any image to inspect full size
                </span>
              </div>

              <div className="grid-2" style={{ gap: '1.25rem' }}>
                <EvidencePhotoCard
                  label="BEFORE — Reported Condition"
                  badgeText="Initial Defect"
                  badgeBg="#FEF3C7"
                  badgeColor="#92400E"
                  src={beforePhotoUrl}
                  emptyTitle="No Initial Photo Attached"
                  emptySubtitle="Citizen or inspector has not uploaded a before-repair photograph yet."
                  onEnlarge={(src, title) => setLightbox({ src, title })}
                />

                <EvidencePhotoCard
                  label="AFTER — Post-Repair Proof"
                  badgeText={afterPhotoUrl ? 'Uploaded' : 'Pending'}
                  badgeBg={afterPhotoUrl ? '#DCFCE7' : '#E2E8F0'}
                  badgeColor={afterPhotoUrl ? '#166534' : '#475569'}
                  src={afterPhotoUrl}
                  emptyTitle={
                    ['Resolved', 'Citizen-Confirmed'].includes(currentTicket.currentStatus)
                      ? 'No Post-Repair Photo Recorded'
                      : 'Awaiting Field Remediation Proof'
                  }
                  emptySubtitle={
                    ['Resolved', 'Citizen-Confirmed'].includes(currentTicket.currentStatus)
                      ? 'Marked resolved without an attached post-repair photograph.'
                      : 'Field engineer uploads post-repair proof before submitting completion.'
                  }
                  onEnlarge={(src, title) => setLightbox({ src, title })}
                />
              </div>

              {(currentTicket.inspection?.remarks || currentTicket.inspection?.completionNote) && (
                <div
                  style={{
                    marginTop: '1rem',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--color-border)',
                    borderLeft: '4px solid var(--color-gov-blue)',
                    padding: '0.875rem 1rem',
                    borderRadius: '2px',
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  {currentTicket.inspection?.remarks && (
                    <div style={{ marginBottom: currentTicket.inspection?.completionNote ? '0.35rem' : 0 }}>
                      <strong style={{ color: 'var(--color-primary-navy)' }}>Field Inspection Notes: </strong>
                      {currentTicket.inspection.remarks}
                    </div>
                  )}
                  {currentTicket.inspection?.completionNote && (
                    <div>
                      <strong style={{ color: 'var(--color-success-green)' }}>Completion Summary: </strong>
                      {currentTicket.inspection.completionNote}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Visual Multi-Stage Progress Lifecycle */}
            <div style={{ marginBottom: '2.5rem' }}>
              <div className="section-heading">
                <span>Multi-Stage Redressal Timeline</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  Audited under Municipal By-laws 2026
                </span>
              </div>

              {(!currentTicket.timeline || currentTicket.timeline.length === 0) ? (
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid var(--color-border)', padding: '1.25rem', borderRadius: '2px', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  No timeline events recorded yet.
                </div>
              ) : (
                <div
                  style={{
                    position: 'relative',
                    paddingLeft: '2rem',
                    borderLeft: '3px solid #CBD5E1',
                    marginLeft: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem'
                  }}
                >
                  {currentTicket.timeline.map((step, idx) => (
                    <div key={`${step.stage}-${idx}`} style={{ position: 'relative', opacity: step.completed ? 1 : 0.72 }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: '-2.75rem',
                          top: '2px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: step.completed ? 'var(--color-success-green)' : '#FFFFFF',
                          border: step.completed ? '2px solid var(--color-success-green)' : '2px solid #94A3B8',
                          color: step.completed ? '#FFFFFF' : '#94A3B8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}
                      >
                        {step.completed ? '✓' : idx + 1}
                      </div>

                      <div
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--color-border)',
                          padding: '1rem 1.25rem',
                          borderRadius: '2px',
                          boxShadow: 'var(--shadow-subtle)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--color-primary-navy)', fontSize: '0.9375rem' }}>
                            {step.title}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {step.date || (step.completed ? 'Recorded' : 'Pending')}
                          </div>
                        </div>

                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0.5rem 0', lineHeight: 1.5 }}>
                          {step.description}
                        </p>

                        <div style={{ fontSize: '0.75rem', color: 'var(--color-gov-blue)', fontWeight: 600 }}>
                          Responsible Desk: {step.officer || 'Awaiting Stage Execution'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {actionError && (
              <div style={{ marginBottom: '1rem' }}>
                <Alert type="danger" title="Action Failed">
                  {actionError}
                </Alert>
              </div>
            )}

            {actionSuccess && (
              <div style={{ marginBottom: '1rem' }}>
                <Alert type="success" title="Audit Record Updated">
                  {actionSuccess}
                </Alert>
              </div>
            )}

            {/* Interactive Community Verification & Citizen Confirmation Protocol */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: currentTicket.currentStatus === 'Citizen-Confirmed' ? '2px solid var(--color-success-green)' :
                        currentTicket.currentStatus === 'Reopened - Under Investigation' ? '2px solid var(--color-alert-red)' :
                        '2px solid var(--color-gold)',
                padding: '1.5rem',
                borderRadius: '2px',
                marginBottom: '2rem'
              }}
            >
              {currentTicket.currentStatus === 'Citizen-Confirmed' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: '#DCFCE7',
                      color: 'var(--color-success-green)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h4 style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-success-green)', margin: '0 0 0.25rem 0' }}>
                      Citizen-Confirmed: Grievance Formally Closed
                    </h4>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                      The affected ward resident has physically verified on site that the remediation work was completed to satisfaction.
                    </p>
                  </div>
                </div>
              ) : currentTicket.currentStatus === 'Reopened - Under Investigation' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: '#FEE2E2',
                      color: 'var(--color-alert-red)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <RotateCcw size={24} />
                  </div>
                  <div>
                    <h4 style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-alert-red)', margin: '0 0 0.25rem 0' }}>
                      Grievance Reopened: Issue Persists on Ground
                    </h4>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                      Citizen physical inspection rejected previous remediation. Returned to municipal authority for re-assignment and re-inspection.
                    </p>
                  </div>
                </div>
              ) : currentTicket.currentStatus === 'Resolved' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ flex: '1 1 380px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span className="badge badge-resolved">Field Remediation Submitted</span>
                        <strong style={{ color: 'var(--color-primary-navy)' }}>Citizen Final Sign-Off Mandated</strong>
                      </div>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0, maxWidth: '640px' }}>
                        The field engineering squad has reported completion of this work order. As a resident of <strong>{currentTicket.ward}</strong>, does this resolve the issue on the ground?
                      </p>
                    </div>

                    {!isCitizenActor ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#F8FAFC', border: '1px solid var(--color-border)', padding: '0.65rem 0.9rem', borderRadius: '2px', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        <Lock size={15} />
                        <span>Sign in with a Citizen account to confirm or dispute resolution.</span>
                        <Button variant="secondary" size="sm" onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/track?ticket=${currentTicket.ticketNumber}`)}`)}>
                          Switch / Login
                        </Button>
                      </div>
                    ) : !disputeOpen ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: '280px' }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Optional confirmation note..."
                          value={citizenComment}
                          onChange={(e) => setCitizenComment(e.target.value)}
                          disabled={actionBusy}
                          style={{ fontSize: '0.8125rem' }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <Button
                            variant="success"
                            icon={Check}
                            disabled={actionBusy}
                            onClick={handleConfirmResolution}
                          >
                            {actionBusy ? 'Submitting...' : 'Confirm Resolution (Sign-Off)'}
                          </Button>
                          <Button
                            variant="danger"
                            icon={RotateCcw}
                            disabled={actionBusy}
                            onClick={() => {
                              setActionError('');
                              setDisputeOpen(true);
                            }}
                          >
                            Dispute &amp; Reopen
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {disputeOpen && isCitizenActor && (
                    <form
                      onSubmit={handleDisputeSubmit}
                      style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        backgroundColor: '#FEF2F2',
                        border: '1px solid var(--color-alert-border)',
                        borderRadius: '2px'
                      }}
                    >
                      <label className="form-label" style={{ color: '#991B1B', fontSize: '0.8125rem' }}>
                        Reason for Reopening / Incomplete Remediation <span className="required">*</span>
                      </label>
                      <textarea
                        rows={3}
                        className="form-control"
                        placeholder="Describe what remains defective on site (required)..."
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        disabled={actionBusy}
                        required
                        style={{ marginBottom: '0.75rem', fontSize: '0.8125rem' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button variant="danger" type="submit" icon={RotateCcw} disabled={actionBusy || disputeReason.trim().length < 3}>
                          {actionBusy ? 'Reopening...' : 'Submit Dispute & Reopen'}
                        </Button>
                        <Button
                          variant="secondary"
                          type="button"
                          disabled={actionBusy}
                          onClick={() => {
                            setDisputeOpen(false);
                            setDisputeReason('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h4 style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-primary-navy)', margin: '0 0 0.25rem 0' }}>
                      Community Verification Protocol
                    </h4>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0, maxWidth: '640px' }}>
                      Are you a resident of <strong>{currentTicket.ward}</strong>? Endorse this report if you have observed the issue on site to strengthen municipal priority.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {isCitizenActor ? (
                      <Button
                        variant={isVoted ? 'success' : 'gold'}
                        icon={isVoted ? CheckCircle2 : ThumbsUp}
                        onClick={handleVerificationVote}
                        disabled={isVoted || actionBusy}
                      >
                        {isVoted ? 'Endorsed by You' : actionBusy ? 'Endorsing...' : 'Endorse Issue (+1)'}
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        icon={Lock}
                        onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/track?ticket=${currentTicket.ticketNumber}`)}`)}
                      >
                        Sign In as Citizen to Endorse
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal for Full-Size Photo Inspection */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(11, 37, 69, 0.85)',
            zIndex: 2500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              maxWidth: '840px',
              width: '100%',
              borderRadius: '2px',
              borderTop: '4px solid var(--color-gold)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
              <strong style={{ color: 'var(--color-primary-navy)', fontSize: '0.9375rem' }}>{lightbox.title}</strong>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                aria-label="Close enlarged photo"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
              >
                <X size={18} />
                <span>Close</span>
              </button>
            </div>
            <div style={{ backgroundColor: '#0F172A', padding: '1rem', textAlign: 'center' }}>
              <img
                src={lightbox.src}
                alt={lightbox.title}
                style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackComplaintPage;
