import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useReports } from '../../hooks/useReports';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import LiveDataNotice from '../../components/common/LiveDataNotice';
import {
  MapPin,
  Camera,
  CheckCircle2,
  Upload,
  HardHat,
  FileText,
  PlayCircle
} from 'lucide-react';
import { compressImageFileToDataUrl, validatePhotoValueForApi } from '../../lib/imageUtils';

function parseInspectionRemarks(rawRemarks) {
  const text = String(rawRemarks || '').trim();
  if (!text) {
    return { measurements: '', recommendedSquad: '', remarks: '' };
  }

  let measurements = '';
  let recommendedSquad = '';
  const remainingNotes = [];

  text.split(' | ').forEach((part) => {
    if (part.startsWith('Measurements:')) {
      measurements = part.replace(/^Measurements:s*/, '').trim();
    } else if (part.startsWith('Squad:')) {
      recommendedSquad = part.replace(/^Squad:s*/, '').trim();
    } else {
      remainingNotes.push(part);
    }
  });

  return {
    measurements,
    recommendedSquad,
    remarks: remainingNotes.join(' | ').trim()
  };
}

function InspectionWorkflowBody({
  currentTicket,
  resolvedTicketId,
  user,
  isMockMode,
  fetchTicketDetails,
  updateFieldInspection,
  onFeedback
}) {
  const isAssigned = currentTicket.currentStatus === 'Assigned';
  const isInProgress = currentTicket.currentStatus === 'In Progress';
  const isEditableWorkStage = isAssigned || isInProgress;
  const isReopenedCycle =
    isEditableWorkStage && Boolean(currentTicket?.inspection?.completedAt);

  const parsedInitial = useMemo(
    () =>
      parseInspectionRemarks(
        currentTicket?.inspection?.remarks || currentTicket?.inspectionDetails?.inspectionRemarks
      ),
    [currentTicket]
  );

  const [localInspectionStarted, setLocalInspectionStarted] = useState(false);
  const inspectionStarted = Boolean(
    localInspectionStarted ||
      currentTicket?.inspection?.startedAt ||
      currentTicket?.inspectionDetails?.inspectionStartedAt
  );

  const [measurements, setMeasurements] = useState(parsedInitial.measurements);
  const [recommendedSquad, setRecommendedSquad] = useState(parsedInitial.recommendedSquad);
  const [inspectionRemarks, setInspectionRemarks] = useState(parsedInitial.remarks);

  const [beforePhotoInput, setBeforePhotoInput] = useState('');
  const [afterPhotoInput, setAfterPhotoInput] = useState('');
  const [beforeUrlDraft, setBeforeUrlDraft] = useState('');
  const [afterUrlDraft, setAfterUrlDraft] = useState('');
  const [completionReport, setCompletionReport] = useState(
    isReopenedCycle
      ? ''
      : currentTicket?.inspection?.completionNote ||
          currentTicket?.inspectionDetails?.completionReport ||
          ''
  );
  const [actionBusy, setActionBusy] = useState(false);

  const beforePhotoPreview =
    beforePhotoInput ||
    currentTicket?.inspection?.beforePhotoUrl ||
    currentTicket?.inspectionDetails?.beforePhotoUrl ||
    currentTicket?.photoUrl ||
    '';

  // In a reopened/reassigned cycle, ignore the previous cycle's completion photo so a fresh proof must be uploaded.
  const afterPhotoPreview = isReopenedCycle
    ? afterPhotoInput
    : afterPhotoInput ||
      currentTicket?.inspection?.afterPhotoUrl ||
      currentTicket?.inspectionDetails?.afterPhotoUrl ||
      '';

  const authorityDirectives = useMemo(() => {
    const timeline = Array.isArray(currentTicket?.timeline) ? currentTicket.timeline : [];
    const assignedStep = [...timeline]
      .reverse()
      .find((step) => step.stage === 'Assigned' && step.description);
    return (
      assignedStep?.description ||
      'Follow standard field inspection procedures, record physical measurements, and attach before/after photographic evidence.'
    );
  }, [currentTicket]);

  const runInspectionStep = async (payload, successMsg) => {
    if (!resolvedTicketId || actionBusy) return false;
    setActionBusy(true);
    onFeedback({ error: '', success: '' });
    try {
      await updateFieldInspection(resolvedTicketId, {
        ...payload,
        officerUser: user
      });
      if (!isMockMode) {
        await fetchTicketDetails(resolvedTicketId);
      }
      onFeedback({ error: '', success: successMsg });
      return true;
    } catch (err) {
      onFeedback({ error: err?.message || 'Unable to save inspection step.', success: '' });
      return false;
    } finally {
      setActionBusy(false);
    }
  };

  const handleBeforePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !isEditableWorkStage || actionBusy) return;
    onFeedback({ error: '', success: '' });
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setBeforePhotoInput(compressed);
      await runInspectionStep(
        { action: 'upload_before_photo', photoUrl: compressed, beforePhotoUrl: compressed },
        'Before-remediation photographic evidence saved.'
      );
    } catch (err) {
      onFeedback({ error: err?.message || 'Unable to process before photograph.', success: '' });
    }
  };

  const handleSaveBeforePhotoUrl = async () => {
    if (!isEditableWorkStage || actionBusy) return;
    onFeedback({ error: '', success: '' });
    try {
      const validUrl = validatePhotoValueForApi(beforeUrlDraft);
      if (!validUrl) {
        onFeedback({ error: 'Please enter an http(s) URL for the before photograph.', success: '' });
        return;
      }
      setBeforePhotoInput(validUrl);
      setBeforeUrlDraft('');
      await runInspectionStep(
        { action: 'upload_before_photo', photoUrl: validUrl, beforePhotoUrl: validUrl },
        'Before-remediation photo URL saved.'
      );
    } catch (err) {
      onFeedback({ error: err?.message || 'Invalid before photo URL.', success: '' });
    }
  };

  const handleAfterPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !isInProgress || actionBusy) return;
    onFeedback({ error: '', success: '' });
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setAfterPhotoInput(compressed);
      await runInspectionStep(
        { action: 'upload_after_photo', photoUrl: compressed, afterPhotoUrl: compressed },
        'After-remediation photographic evidence saved.'
      );
    } catch (err) {
      onFeedback({ error: err?.message || 'Unable to process after photograph.', success: '' });
    }
  };

  const handleSaveAfterPhotoUrl = async () => {
    if (!isInProgress || actionBusy) return;
    onFeedback({ error: '', success: '' });
    try {
      const validUrl = validatePhotoValueForApi(afterUrlDraft);
      if (!validUrl) {
        onFeedback({ error: 'Please enter an http(s) URL for the after photograph.', success: '' });
        return;
      }
      setAfterPhotoInput(validUrl);
      setAfterUrlDraft('');
      await runInspectionStep(
        { action: 'upload_after_photo', photoUrl: validUrl, afterPhotoUrl: validUrl },
        'After-remediation photo URL saved.'
      );
    } catch (err) {
      onFeedback({ error: err?.message || 'Invalid after photo URL.', success: '' });
    }
  };

  const handleLoadDemoAfterPhoto = async () => {
    if (!isMockMode || !isInProgress || actionBusy) return;
    const demoAfterUrl =
      'https://images.unsplash.com/photo-1584463699059-88029d5970c7?auto=format&fit=crop&w=600&q=80';
    setAfterPhotoInput(demoAfterUrl);
    await runInspectionStep(
      { action: 'upload_after_photo', photoUrl: demoAfterUrl, afterPhotoUrl: demoAfterUrl },
      'Demo post-remediation photographic proof uploaded.'
    );
  };

  const handleStartInspection = async () => {
    if (!isAssigned || inspectionStarted || actionBusy) return;
    const ok = await runInspectionStep(
      { action: 'start_inspection' },
      'Site inspection marked as STARTED. Timestamp logged in municipal audit trail.'
    );
    if (ok) setLocalInspectionStarted(true);
  };

  const handleSubmitInspectionRemarks = async (e) => {
    e.preventDefault();
    if (!isEditableWorkStage || !inspectionStarted || actionBusy) return;
    await runInspectionStep(
      {
        action: 'submit_inspection',
        remarks: inspectionRemarks,
        measurements,
        recommendedSquad
      },
      'Engineering inspection findings and measurements recorded.'
    );
  };

  const handleMarkWorkInProgress = async () => {
    if (!isAssigned || !inspectionStarted || actionBusy) return;
    await runInspectionStep(
      {
        action: 'start_work',
        remarks: 'Field squad deployed on site. Remediation work in progress.'
      },
      'Work Order marked as IN PROGRESS. Field squad officially deployed.'
    );
  };

  const handleSubmitCompletionReport = async (e) => {
    e.preventDefault();
    if (!isInProgress || actionBusy) return;
    if (!afterPhotoPreview) {
      onFeedback({
        error: 'Please upload a post-repair photograph before submitting the completion report.',
        success: ''
      });
      return;
    }

    if (!isMockMode && afterPhotoInput) {
      const uploaded = await runInspectionStep(
        { action: 'upload_after_photo', photoUrl: afterPhotoInput, afterPhotoUrl: afterPhotoInput },
        'After photo synced.'
      );
      if (!uploaded) return;
    }

    await runInspectionStep(
      {
        action: 'complete_work',
        completionReport,
        beforePhotoUrl: beforePhotoPreview,
        afterPhotoUrl: afterPhotoPreview
      },
      'Work order marked as RESOLVED! Evidence submitted to Citizen Verification Protocol for citizen sign-off.'
    );
  };

  return (
    <div>
      {/* Header Summary Box */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--color-border)',
          borderTop: '4px solid var(--color-gold)',
          borderRadius: '2px',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-card)',
          marginBottom: '1.5rem'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem',
            borderBottom: '1px solid var(--color-border-light)',
            paddingBottom: '1rem',
            marginBottom: '1rem'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  fontSize: '1.25rem',
                  color: 'var(--color-primary-navy)'
                }}
              >
                {currentTicket.ticketNumber}
              </span>
              <Badge status={currentTicket.currentStatus} />
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '2px',
                  backgroundColor: '#FEF3C7',
                  color: '#92400E'
                }}
              >
                {currentTicket.urgencyLevel}
              </span>
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.25rem',
                color: 'var(--color-primary-navy)',
                margin: '0.35rem 0'
              }}
            >
              {currentTicket.subject}
            </h3>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              <MapPin size={12} style={{ display: 'inline', marginRight: '3px' }} />
              {currentTicket.address} • {currentTicket.ward}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Resolution Target SLA:
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-success-green)', marginTop: '2px' }}>
              {currentTicket.expectedResolutionDate}
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid var(--color-border)',
            padding: '0.875rem 1rem',
            borderRadius: '2px',
            fontSize: '0.8125rem'
          }}
        >
          <strong style={{ color: 'var(--color-gov-blue)' }}>
            Authority Work Order Instructions:{' '}
          </strong>
          <span>{authorityDirectives}</span>
        </div>

        {!isEditableWorkStage && (
          <div style={{ marginTop: '0.9rem' }}>
            <Alert type="info" title={`Ticket Status: ${currentTicket.currentStatus}`}>
              {currentTicket.currentStatus === 'Resolved'
                ? 'Remediation has already been submitted and is awaiting independent citizen confirmation or dispute.'
                : currentTicket.currentStatus === 'Citizen-Confirmed'
                  ? 'This complaint has been confirmed by a citizen and closed.'
                  : currentTicket.currentStatus === 'Reopened - Under Investigation'
                    ? 'This ticket was reopened by a citizen and awaits Authority reassignment to a field officer before field inspection can resume.'
                    : `Inspection execution steps become active once the ticket is assigned to you (current status: ${currentTicket.currentStatus}).`}
            </Alert>
          </div>
        )}

        {isReopenedCycle && (
          <div style={{ marginTop: '0.9rem' }}>
            <Alert type="warning" title="Reopened Remediation Cycle">
              This ticket was reopened after a previous completion report. Please upload a new post-repair photograph and a new completion summary before resubmitting.
            </Alert>
          </div>
        )}
      </div>

      {/* 6 Actions Execution Panels */}
      <div className="grid-2" style={{ gap: '1.5rem', marginBottom: '2rem', alignItems: 'flex-start' }}>
        {/* Panel 1: Actions 1, 2, 3 */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--color-border)',
            borderRadius: '2px',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-subtle)'
          }}
        >
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.125rem', color: 'var(--color-primary-navy)', margin: '0 0 1rem 0' }}>
            Phase 1: Site Inspection &amp; Squad Dispatch
          </h3>

          {/* Action 1: Mark Inspection Started */}
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#F8FAFC',
              border: '1px solid var(--color-border)',
              borderRadius: '2px',
              marginBottom: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--color-primary-navy)', fontSize: '0.875rem' }}>
                  Action 1: Mark Inspection Started
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {!isAssigned && !inspectionStarted
                    ? 'Requires Assigned status to initiate inspection.'
                    : 'Log physical arrival of engineer inspection team at the defect location.'}
                </div>
              </div>
              <Button
                variant={inspectionStarted ? 'success' : 'primary'}
                size="sm"
                icon={inspectionStarted ? CheckCircle2 : PlayCircle}
                onClick={handleStartInspection}
                disabled={inspectionStarted || !isAssigned || actionBusy}
              >
                {inspectionStarted ? 'Inspection Active' : 'Start Inspection'}
              </Button>
            </div>
          </div>

          {/* Action 2: Submit Inspection Remarks */}
          <form onSubmit={handleSubmitInspectionRemarks} style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--color-primary-navy)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Action 2: Technical Defect Assessment &amp; Measurements
            </div>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>
                Physical Defect Measurements &amp; Scope:
              </label>
              <input
                type="text"
                className="form-control"
                value={measurements}
                onChange={(e) => setMeasurements(e.target.value)}
                placeholder="e.g. Crater dimensions, affected span, or fixture count"
                style={{ fontSize: '0.8125rem' }}
                disabled={actionBusy || !isEditableWorkStage || !inspectionStarted}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>
                Assigned Engineering / Contractor Squad:
              </label>
              <input
                type="text"
                className="form-control"
                value={recommendedSquad}
                onChange={(e) => setRecommendedSquad(e.target.value)}
                placeholder="e.g. Ward Maintenance Squad / Electrical Unit"
                style={{ fontSize: '0.8125rem' }}
                disabled={actionBusy || !isEditableWorkStage || !inspectionStarted}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>
                Field Engineer Site Notes &amp; Diagnostics <span className="required">*</span>
              </label>
              <textarea
                className="form-control"
                rows={3}
                value={inspectionRemarks}
                onChange={(e) => setInspectionRemarks(e.target.value)}
                placeholder="Record on-site assessment findings and corrective plan..."
                style={{ fontSize: '0.8125rem' }}
                disabled={actionBusy || !isEditableWorkStage || !inspectionStarted}
                required
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              type="submit"
              icon={FileText}
              disabled={actionBusy || !isEditableWorkStage || !inspectionStarted}
            >
              {actionBusy ? 'Saving Remarks...' : 'Submit & Log Inspection Remarks'}
            </Button>
          </form>

          {/* Action 3: Mark Work In Progress */}
          <div style={{ padding: '1rem', backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#0369A1', fontSize: '0.875rem' }}>
                  Action 3: Mobilize Squad &amp; Mark Work In Progress
                </div>
                <div style={{ fontSize: '0.75rem', color: '#0284C7' }}>
                  {isInProgress
                    ? 'Work is currently In Progress.'
                    : !inspectionStarted
                      ? 'Start site inspection (Action 1) before marking In Progress.'
                      : 'Transitions live grievance status to "In Progress".'}
                </div>
              </div>
              <Button
                variant="gold"
                size="sm"
                icon={HardHat}
                disabled={actionBusy || !isAssigned || !inspectionStarted}
                onClick={handleMarkWorkInProgress}
              >
                {isInProgress ? 'In Progress' : 'Mark In Progress'}
              </Button>
            </div>
          </div>
        </div>

        {/* Panel 2: Actions 4, 5, 6 */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--color-border)',
            borderRadius: '2px',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-subtle)'
          }}
        >
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.125rem', color: 'var(--color-primary-navy)', margin: '0 0 1rem 0' }}>
            Phase 2: Photo Proof &amp; Work Completion Sign-off
          </h3>

          {/* Action 4 & 5: Before and After Photographs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            {/* Action 4: Before Photo */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary-navy)', marginBottom: '0.35rem' }}>
                Action 4: Before Photo
              </div>
              <div
                style={{
                  height: '140px',
                  border: '1px solid var(--color-border)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  backgroundColor: '#F8FAFC',
                  marginBottom: '0.5rem'
                }}
              >
                {beforePhotoPreview ? (
                  <img src={beforePhotoPreview} alt="Before remediation" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', fontSize: '0.75rem' }}>
                    No Before Photo
                  </div>
                )}
              </div>
              <label
                style={{
                  display: 'block',
                  backgroundColor: '#F1F5F9',
                  border: '1px solid var(--color-border)',
                  padding: '4px 8px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  borderRadius: '2px',
                  cursor: !isEditableWorkStage || actionBusy ? 'not-allowed' : 'pointer',
                  opacity: !isEditableWorkStage || actionBusy ? 0.6 : 1
                }}
              >
                <Upload size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Upload Compressed File (&le;60KB)
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBeforePhotoChange}
                  disabled={!isEditableWorkStage || actionBusy}
                  style={{ display: 'none' }}
                />
              </label>
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                <input
                  type="url"
                  className="form-control"
                  placeholder="https://... before photo URL"
                  value={beforeUrlDraft}
                  onChange={(e) => setBeforeUrlDraft(e.target.value)}
                  disabled={!isEditableWorkStage || actionBusy}
                  style={{ fontSize: '0.6875rem', padding: '3px 6px' }}
                />
                <button
                  type="button"
                  disabled={!isEditableWorkStage || actionBusy}
                  onClick={handleSaveBeforePhotoUrl}
                  style={{
                    backgroundColor: '#EEF3F8',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-gov-blue)',
                    padding: '3px 8px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    borderRadius: '2px',
                    cursor: !isEditableWorkStage || actionBusy ? 'not-allowed' : 'pointer'
                  }}
                >
                  Save
                </button>
              </div>
            </div>

            {/* Action 5: After Photo */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary-navy)', marginBottom: '0.35rem' }}>
                Action 5: After Photo (Proof)
              </div>
              <div
                style={{
                  height: '140px',
                  border: afterPhotoPreview ? '2px solid var(--color-success-green)' : '1px dashed #CBD5E1',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  backgroundColor: '#F8FAFC',
                  marginBottom: '0.5rem'
                }}
              >
                {afterPhotoPreview ? (
                  <img src={afterPhotoPreview} alt="After remediation proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', fontSize: '0.75rem', padding: '0.5rem', textAlign: 'center' }}>
                    <Camera size={20} style={{ marginBottom: '4px' }} />
                    <span>
                      {isReopenedCycle
                        ? 'Upload Fresh Post-Repair Photo'
                        : isInProgress
                          ? 'Awaiting After-Work Evidence'
                          : 'Mark Work In Progress First'}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <label
                  style={{
                    flex: 1,
                    backgroundColor: '#F1F5F9',
                    border: '1px solid var(--color-border)',
                    padding: '4px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    textAlign: 'center',
                    borderRadius: '2px',
                    cursor: !isInProgress || actionBusy ? 'not-allowed' : 'pointer',
                    opacity: !isInProgress || actionBusy ? 0.6 : 1
                  }}
                >
                  <Upload size={11} style={{ display: 'inline', marginRight: '3px' }} />
                  File
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAfterPhotoChange}
                    disabled={!isInProgress || actionBusy}
                    style={{ display: 'none' }}
                  />
                </label>
                {isMockMode && (
                  <button
                    type="button"
                    disabled={!isInProgress || actionBusy}
                    onClick={handleLoadDemoAfterPhoto}
                    style={{
                      flex: 1,
                      backgroundColor: '#FEF3C7',
                      border: '1px solid #FDE68A',
                      color: '#92400E',
                      padding: '4px',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      borderRadius: '2px',
                      cursor: !isInProgress || actionBusy ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Demo Proof
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                <input
                  type="url"
                  className="form-control"
                  placeholder="https://... after photo URL"
                  value={afterUrlDraft}
                  onChange={(e) => setAfterUrlDraft(e.target.value)}
                  disabled={!isInProgress || actionBusy}
                  style={{ fontSize: '0.6875rem', padding: '3px 6px' }}
                />
                <button
                  type="button"
                  disabled={!isInProgress || actionBusy}
                  onClick={handleSaveAfterPhotoUrl}
                  style={{
                    backgroundColor: '#EEF3F8',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-gov-blue)',
                    padding: '3px 8px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    borderRadius: '2px',
                    cursor: !isInProgress || actionBusy ? 'not-allowed' : 'pointer'
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Action 6: Submit Completion Report */}
          <form onSubmit={handleSubmitCompletionReport}>
            <div style={{ fontWeight: 700, color: 'var(--color-primary-navy)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Action 6: Engineering Completion Certification
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>
                Technical Completion Summary <span className="required">*</span>
              </label>
              <textarea
                className="form-control"
                rows={3}
                value={completionReport}
                onChange={(e) => setCompletionReport(e.target.value)}
                placeholder="Describe remediation executed, materials used, and post-repair verification checks..."
                style={{ fontSize: '0.8125rem' }}
                disabled={!isInProgress || actionBusy}
                required
              />
            </div>

            <Button
              variant="success"
              type="submit"
              fullWidth
              icon={CheckCircle2}
              disabled={actionBusy || !isInProgress || !afterPhotoPreview}
              style={{ fontWeight: 700, padding: '0.75rem' }}
            >
              {actionBusy ? 'Submitting...' : 'Submit Remediation Completion Report'}
            </Button>

            <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
              <strong>Statutory Notice:</strong> Submitting this report advances ticket to <em>Resolved</em> (requires <em>In Progress</em> status and an uploaded post-repair photo). Final <em>Citizen-Confirmed</em> status requires independent resident sign-off.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export const OfficerInspectionsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedTicket = searchParams.get('ticket') || '';

  const { user } = useAuth();
  const {
    reports,
    getTicket,
    fetchTicketDetails,
    updateFieldInspection,
    isMockMode,
    isLoading,
    apiError,
    refreshData
  } = useReports();

  const officerId = user?.id || 'OFF-PWD-014';
  const officerName = user?.name || 'Mr. V. Nair';

  const myAssignedReports = useMemo(() => {
    return reports.filter(
      (r) =>
        r.assignedOfficerId === officerId ||
        (r.assignedOfficer && r.assignedOfficer.includes(officerName))
    );
  }, [reports, officerId, officerName]);

  const [activeTicketId, setActiveTicketId] = useState(
    requestedTicket || (myAssignedReports[0]?.ticketNumber || (isMockMode ? 'CR-2026-8842' : ''))
  );
  const resolvedTicketId = activeTicketId || myAssignedReports[0]?.ticketNumber || '';
  const normalizedTargetKey = resolvedTicketId.trim().toUpperCase();

  // Sync if query param changes
  const [prevParam, setPrevParam] = useState(requestedTicket);
  if (requestedTicket !== prevParam) {
    setPrevParam(requestedTicket);
    if (requestedTicket) {
      setActiveTicketId(requestedTicket);
    }
  }

  const [directFetchState, setDirectFetchState] = useState({
    key: '',
    error: '',
    ticket: null
  });

  useEffect(() => {
    if (isMockMode || !normalizedTargetKey) return undefined;
    let cancelled = false;

    fetchTicketDetails(normalizedTargetKey)
      .then((res) => {
        if (!cancelled) {
          setDirectFetchState({
            key: normalizedTargetKey,
            error: res?.ticket ? '' : `Ticket "${normalizedTargetKey}" could not be found.`,
            ticket: res?.ticket || null
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDirectFetchState({
            key: normalizedTargetKey,
            error: err?.message || `Unable to load ticket "${normalizedTargetKey}".`,
            ticket: null
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isMockMode, normalizedTargetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentTicket =
    getTicket(resolvedTicketId) ||
    (!isMockMode && directFetchState.key === normalizedTargetKey ? directFetchState.ticket : null);

  const directFetchLoading =
    !isMockMode &&
    Boolean(normalizedTargetKey) &&
    !currentTicket &&
    directFetchState.key !== normalizedTargetKey;
  const directFetchError =
    !isMockMode && !currentTicket && directFetchState.key === normalizedTargetKey
      ? directFetchState.error
      : '';

  const [actionErrorNotice, setActionErrorNotice] = useState('');
  const [actionSuccessNotice, setActionSuccessNotice] = useState('');

  const effectiveApiError = apiError || directFetchError || null;
  const effectiveLoading = isLoading || directFetchLoading;

  const formResetKey = currentTicket
    ? `${currentTicket.ticketNumber}::${currentTicket.currentStatus}::${currentTicket.inspection?.completedAt || 'open'}`
    : 'none';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', color: 'var(--color-primary-navy)', margin: '0 0 0.25rem 0' }}>
            Site Inspection &amp; Work Order Execution Console
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: 0 }}>
            Field inspection logging, defect measurements, before/after evidence photographic upload, and completion certification.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="secondary" onClick={() => navigate('/officer/assigned-work')}>
            ← Back to Work Orders
          </Button>
        </div>
      </div>

      <LiveDataNotice
        isMockMode={isMockMode}
        isLoading={effectiveLoading}
        apiError={effectiveApiError}
        onRetry={refreshData}
        resourceLabel="field inspection work orders"
      />

      {actionErrorNotice && (
        <div style={{ marginBottom: '1.25rem' }}>
          <Alert type="danger" title="Inspection Action Failed">
            {actionErrorNotice}
          </Alert>
        </div>
      )}

      {actionSuccessNotice && (
        <div style={{ marginBottom: '1.25rem' }}>
          <Alert type="success" title="Field Operation Successfully Recorded">
            {actionSuccessNotice}
          </Alert>
        </div>
      )}

      {/* Select Active Work Order */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--color-border)',
          borderRadius: '2px',
          padding: '1rem 1.25rem',
          boxShadow: 'var(--shadow-subtle)',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}
      >
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-primary-navy)' }}>
          Active Assignment Ticket:
        </span>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {!isMockMode && effectiveLoading && myAssignedReports.length === 0 && (
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              Loading assigned tickets...
            </span>
          )}
          {!isMockMode && effectiveApiError && myAssignedReports.length === 0 && (
            <span style={{ fontSize: '0.8125rem', color: '#991B1B' }}>
              Unable to load assigned tickets.
            </span>
          )}
          {myAssignedReports.map((r) => (
            <button
              key={r.ticketNumber}
              type="button"
              onClick={() => {
                setActiveTicketId(r.ticketNumber);
                setSearchParams({ ticket: r.ticketNumber });
                setActionErrorNotice('');
                setActionSuccessNotice('');
              }}
              style={{
                backgroundColor: resolvedTicketId === r.ticketNumber ? 'var(--color-gov-blue)' : '#F1F5F9',
                color: resolvedTicketId === r.ticketNumber ? '#FFFFFF' : 'var(--color-dark-slate)',
                border: '1px solid var(--color-border)',
                borderRadius: '2px',
                padding: '4px 10px',
                fontSize: '0.8125rem',
                fontFamily: 'monospace',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {r.ticketNumber} ({r.severity})
            </button>
          ))}
        </div>
      </div>

      {currentTicket ? (
        <InspectionWorkflowBody
          key={formResetKey}
          currentTicket={currentTicket}
          resolvedTicketId={resolvedTicketId}
          user={user}
          isMockMode={isMockMode}
          fetchTicketDetails={fetchTicketDetails}
          updateFieldInspection={updateFieldInspection}
          onFeedback={({ error, success }) => {
            setActionErrorNotice(error || '');
            setActionSuccessNotice(success || '');
          }}
        />
      ) : !isMockMode && effectiveLoading ? (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)'
          }}
        >
          Loading work order inspection details from backend server...
        </div>
      ) : !isMockMode && effectiveApiError ? (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: '#FEF2F2',
            border: '1px solid var(--color-alert-border)',
            color: '#991B1B'
          }}
        >
          Work order details could not be loaded because the backend request failed. Use Retry Connection above.
        </div>
      ) : (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--color-border)'
          }}
        >
          No work order selected. Please select a ticket from your assigned work list.
        </div>
      )}
    </div>
  );
};

export default OfficerInspectionsPage;
