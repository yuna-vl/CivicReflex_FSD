export const CATEGORY_DISPLAY_NAMES = {
  roads: 'Road Damage / Potholes',
  sanitation: 'Garbage and Waste Management',
  lighting: 'Streetlight Issues',
  drainage: 'Drainage and Waterlogging',
  accessibility: 'Footpath and Accessibility',
  public_safety: 'Public Safety'
};

export function formatDisplayDate(value, fallback = '') {
  if (!value) return fallback;
  if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export function normalizeReport(raw, linkedTicket = null) {
  if (!raw) return null;
  const reportId = raw.reportId || raw.id;
  const ticketNumber = raw.ticketNumber || linkedTicket?.ticketNumber || '';
  const actionsTaken = Array.isArray(raw.actionsTaken)
    ? raw.actionsTaken.map((entry) => ({
        timestamp: formatDisplayDate(entry.timestamp, ''),
        rawTimestamp: entry.timestamp,
        action: entry.action
      }))
    : [];

  return {
    ...raw,
    id: reportId,
    reportId,
    ticketNumber,
    type: raw.type || 'issue',
    location: raw.location || raw.wardNumber || '',
    zone: raw.zone || '',
    wardNumber: raw.wardNumber || '',
    landmark: raw.landmark || '',
    reportedAt: formatDisplayDate(raw.reportedAt || raw.createdAt, 'Recent'),
    reportedAtIso: raw.reportedAt || raw.createdAt || null,
    slaTargetDate: formatDisplayDate(raw.slaTargetDate, 'Pending SLA'),
    slaTargetDateIso: raw.slaTargetDate || null,
    upvotes: raw.upvotes ?? 0,
    verifiedCount: raw.verifiedCount ?? 0,
    verifiedBy: Array.isArray(raw.verifiedBy) ? raw.verifiedBy : [],
    assignedDepartment:
      raw.assignedDepartment ||
      linkedTicket?.assignedAuthority?.department ||
      'Unassigned',
    assignedOfficer:
      raw.assignedOfficer ||
      linkedTicket?.assignedAuthority?.name ||
      'Awaiting Allocation',
    assignedOfficerId:
      raw.assignedOfficerId ??
      linkedTicket?.assignedOfficerId ??
      null,
    beforePhotoUrl:
      raw.beforePhotoUrl ||
      linkedTicket?.inspection?.beforePhotoUrl ||
      raw.photoUrl ||
      null,
    afterPhotoUrl:
      raw.afterPhotoUrl ||
      linkedTicket?.inspection?.afterPhotoUrl ||
      null,
    actionsTaken
  };
}

export function normalizeTicket(raw, linkedReport = null) {
  if (!raw) return null;
  const inspection = raw.inspection || raw.inspectionDetails || {};
  const normalizedInspection = {
    startedAt: inspection.startedAt || inspection.inspectionStartedAt || null,
    remarks: inspection.remarks || inspection.inspectionRemarks || null,
    beforePhotoUrl: inspection.beforePhotoUrl || null,
    afterPhotoUrl: inspection.afterPhotoUrl || null,
    completionNote: inspection.completionNote || inspection.completionReport || null,
    completedAt: inspection.completedAt || null
  };

  const timeline = Array.isArray(raw.timeline)
    ? raw.timeline.map((step) => ({
        stage: step.stage,
        title: step.title,
        description: step.description || '',
        date: step.date ? formatDisplayDate(step.date, '') : null,
        rawDate: step.date || null,
        completed: Boolean(step.completed),
        officer: step.officer || null
      }))
    : [];

  const rawUrgency = raw.rawUrgencyLevel || raw.urgencyLevel || 'Medium';
  const urgencyLevel = String(rawUrgency).includes('Priority')
    ? rawUrgency
    : `${rawUrgency} Priority`;

  return {
    ...raw,
    ticketNumber: raw.ticketNumber,
    reportIds: Array.isArray(raw.reportIds) ? raw.reportIds : [],
    currentStatus: raw.currentStatus || 'Reported',
    urgencyLevel,
    rawUrgencyLevel: String(rawUrgency).replace(/\s+Priority$/i, ''),
    ward: raw.ward || linkedReport?.wardNumber || '',
    category: raw.category || linkedReport?.category || '',
    issueType: raw.issueType || linkedReport?.subcategory || raw.category || '',
    subject: raw.subject || linkedReport?.title || '',
    address: raw.address || linkedReport?.location || raw.ward || '',
    description: raw.description || linkedReport?.description || '',
    photoUrl: raw.photoUrl || linkedReport?.photoUrl || null,
    verifiedCount: raw.verifiedCount ?? linkedReport?.verifiedCount ?? 0,
    verifiedBy: Array.isArray(raw.verifiedBy)
      ? raw.verifiedBy
      : Array.isArray(linkedReport?.verifiedBy)
        ? linkedReport.verifiedBy
        : [],
    submissionDate: formatDisplayDate(raw.submissionDate || raw.createdAt, ''),
    submissionDateIso: raw.submissionDate || raw.createdAt || null,
    expectedResolutionDate: formatDisplayDate(raw.expectedResolutionDate, 'Pending SLA'),
    expectedResolutionDateIso: raw.expectedResolutionDate || null,
    assignedOfficerId: raw.assignedOfficerId ?? null,
    assignedAuthority: {
      name: raw.assignedAuthority?.name || 'Awaiting Allocation',
      designation: raw.assignedAuthority?.designation || 'Zonal Assignment Desk',
      department: raw.assignedAuthority?.department || 'Unassigned',
      contact: raw.assignedAuthority?.contact || ''
    },
    inspection: normalizedInspection,
    inspectionDetails: {
      ...inspection,
      inspectionStartedAt: normalizedInspection.startedAt
        ? formatDisplayDate(normalizedInspection.startedAt)
        : null,
      inspectionRemarks: normalizedInspection.remarks,
      beforePhotoUrl: normalizedInspection.beforePhotoUrl,
      afterPhotoUrl: normalizedInspection.afterPhotoUrl,
      completionReport: normalizedInspection.completionNote,
      completedAt: normalizedInspection.completedAt
        ? formatDisplayDate(normalizedInspection.completedAt)
        : null
    },
    timeline
  };
}

export function extractWardLabel(wardString) {
  if (!wardString) return '';
  return String(wardString).split('(')[0].trim();
}

export function formatShortDate(value, fallback = '') {
  if (!value) return fallback;
  const text = String(value).trim();
  if (!text) return fallback;
  if (text.includes(',')) {
    return text.split(',')[0].trim();
  }
  return text.split(' ')[0].trim();
}

export const BACKEND_STATUS_TRANSITIONS = {
  Reported: {
    authority: ['Verified', 'Under Review', 'Assigned', 'Escalated'],
    admin: ['Verified', 'Under Review', 'Assigned', 'Escalated']
  },
  Verified: {
    authority: ['Verified', 'Under Review', 'Assigned', 'Escalated'],
    admin: ['Verified', 'Under Review', 'Assigned', 'Escalated']
  },
  'Under Review': {
    authority: ['Verified', 'Under Review', 'Assigned', 'Escalated'],
    admin: ['Verified', 'Under Review', 'Assigned', 'Escalated']
  },
  Assigned: {
    field_officer: ['In Progress'],
    authority: ['Escalated', 'Assigned'],
    admin: ['Escalated', 'Assigned']
  },
  'In Progress': {
    field_officer: ['Resolved'],
    authority: ['Escalated'],
    admin: ['Escalated']
  },
  Resolved: {
    citizen: ['Citizen-Confirmed', 'Reopened - Under Investigation']
  },
  'Reopened - Under Investigation': {
    authority: ['Assigned'],
    admin: ['Assigned']
  },
  Escalated: {
    authority: ['Assigned', 'Under Review'],
    admin: ['Assigned', 'Under Review']
  },
  'Citizen-Confirmed': {}
};

// Direct status changes exposed in AuthorityGrievancesPage modal;
// 'Assigned' is handled through AuthorityAssignmentsPage with officer & department fields.
export const AUTHORITY_DIRECT_TRANSITIONS = {
  Reported: ['Verified', 'Under Review', 'Escalated'],
  Verified: ['Under Review', 'Escalated'],
  'Under Review': ['Verified', 'Escalated'],
  Assigned: ['Escalated'],
  'In Progress': ['Escalated'],
  Escalated: ['Under Review'],
  'Reopened - Under Investigation': [],
  Resolved: [],
  'Citizen-Confirmed': []
};

export function getAuthorityDirectTransitions(currentStatus) {
  return AUTHORITY_DIRECT_TRANSITIONS[currentStatus] || [];
}

export function checkStatusTransition(fromStatus, toStatus, role = 'authority') {
  const normalizedRole = String(role || '').trim().toLowerCase();
  const stateMap = BACKEND_STATUS_TRANSITIONS[fromStatus] || {};
  const allTargets = Array.from(new Set(Object.values(stateMap).flat()));
  const roleTargets =
    stateMap[normalizedRole] || (normalizedRole === 'admin' ? stateMap.authority || [] : []);
  return {
    isLifecycleValid: allTargets.includes(toStatus),
    isRoleAllowed: roleTargets.includes(toStatus)
  };
}
