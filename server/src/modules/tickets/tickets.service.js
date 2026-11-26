/**
 * src/modules/tickets/tickets.service.js
 * 
 * Purpose:
 * Business logic layer for Civic Tickets.
 * Handles ticket queries, lifecycle status state transitions with atomic updates,
 * department assignments, field inspections, and citizen resolution confirmation.
 */

const Ticket = require('./ticket.model');
const Report = require('../reports/report.model');
const { checkTransition } = require('../../constants/ticketTransitions');
const { calculateExpectedResolutionDate } = require('../../constants/sla');
const ApiError = require('../../utils/ApiError');
const { safeEmit } = require('../../utils/events'); // announces events
const { logAudit } = require('../audit/audit.service');

/**
 * Retrieves paginated tickets with filtering (newest first)
 * @param {Object} queryParams - Filters (currentStatus, ward, category, assignedOfficerId, page, limit)
 * @returns {Promise<{ items: Array, page: number, limit: number, total: number }>}
 */
const getTickets = async (queryParams) => {
  const { currentStatus, ward, category, assignedOfficerId, page: rawPage, limit: rawLimit } = queryParams;

  const parsedPage = parseInt(rawPage, 10);
  const parsedLimit = parseInt(rawLimit, 10);
  const page = !isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = !isNaN(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (currentStatus) filter.currentStatus = currentStatus;
  if (ward) filter.ward = ward;
  if (category) filter.category = category;
  if (assignedOfficerId) filter.assignedOfficerId = assignedOfficerId;

  const [items, total] = await Promise.all([
    Ticket.find(filter).sort({ submissionDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    Ticket.countDocuments(filter)
  ]);

  return {
    items,
    page,
    limit,
    total
  };
};

/**
 * Retrieves a single ticket by its unique ticket number (e.g. "CR-2026-9001")
 * @param {string} ticketNumber
 * @returns {Promise<Object>}
 */
const getTicketByNumber = async (ticketNumber) => {
  const ticket = await Ticket.findOne({ ticketNumber: ticketNumber.toUpperCase() });
  if (!ticket) {
    throw new ApiError(404, `Ticket with number '${ticketNumber}' not found`);
  }
  return ticket;
};

/**
 * Central function to apply a validated status change to a ticket.
 * Checks transition permissions, executes atomic findOneAndUpdate to prevent race conditions,
 * updates corresponding timeline milestones, and mirrors status changes to linked reports.
 * 
 * @param {Object|string} ticketOrNumber - Ticket document or ticketNumber string
 * @param {string} newStatus - Target status to transition into
 * @param {Object} actor - Caller identity { role, id, name }
 * @param {string} [note] - Descriptive message or audit note
 * @returns {Promise<Object>} - Updated ticket document
 */
const applyStatusChange = async (ticketOrNumber, newStatus, actor, note) => {
  // 1. Resolve ticket document
  const ticketNumber = typeof ticketOrNumber === 'string'
    ? ticketOrNumber.toUpperCase()
    : ticketOrNumber.ticketNumber.toUpperCase();

  const ticket = await Ticket.findOne({ ticketNumber });
  if (!ticket) {
    throw new ApiError(404, `Ticket with number '${ticketNumber}' not found`);
  }

  const currentStatus = ticket.currentStatus;

  // 2. Validate state machine transition rules
  const { isLifecycleValid, isRoleAllowed } = checkTransition(currentStatus, newStatus, actor.role);

  if (!isLifecycleValid) {
    throw new ApiError(409, `Cannot transition ticket from '${currentStatus}' to '${newStatus}'`);
  }

  if (!isRoleAllowed) {
    throw new ApiError(403, `Role '${actor.role}' cannot move a ticket from ${currentStatus} to ${newStatus}`);
  }

  // 3. Enforce field officer ownership
  if (actor.role === 'field_officer' && ticket.assignedOfficerId !== actor.id) {
    throw new ApiError(403, `Field officer '${actor.name}' (${actor.id}) is not assigned to this ticket`);
  }

  // TODO: check the citizen is the reporter once users exist

  // 4. Update timeline stage based on the new status
  // Assigned -> "Assigned", In Progress -> "Execution", Resolved -> "Verification",
  // Citizen-Confirmed -> "Closure", Reopened -> reset "Verification" and "Closure"
  const now = new Date();
  const updatedTimeline = ticket.timeline.map((t) => (t.toObject ? t.toObject() : { ...t }));

  if (newStatus === 'Assigned') {
    const stage = updatedTimeline.find((s) => s.stage === 'Assigned');
    if (stage) {
      stage.completed = true;
      stage.date = now;
      stage.officer = actor.name;
      if (note) stage.description = note;
    }
  } else if (newStatus === 'In Progress') {
    const stage = updatedTimeline.find((s) => s.stage === 'Execution');
    if (stage) {
      stage.completed = true;
      stage.date = now;
      stage.officer = actor.name;
      if (note) stage.description = note;
    }
  } else if (newStatus === 'Resolved') {
    const stage = updatedTimeline.find((s) => s.stage === 'Verification');
    if (stage) {
      stage.completed = true;
      stage.date = now;
      stage.officer = actor.name;
      if (note) stage.description = note;
    }
  } else if (newStatus === 'Citizen-Confirmed') {
    const stage = updatedTimeline.find((s) => s.stage === 'Closure');
    if (stage) {
      stage.completed = true;
      stage.date = now;
      stage.officer = actor.name;
      if (note) stage.description = note;
    }
  } else if (newStatus === 'Reopened - Under Investigation') {
    // Reopened sets Verification and Closure back to not completed
    const verificationStage = updatedTimeline.find((s) => s.stage === 'Verification');
    if (verificationStage) {
      verificationStage.completed = false;
      verificationStage.date = null;
    }
    const closureStage = updatedTimeline.find((s) => s.stage === 'Closure');
    if (closureStage) {
      closureStage.completed = false;
      closureStage.date = null;
    }
  }

  // 5. Atomic update ensuring optimistic locking (currentStatus must still match)
  const updatedTicket = await Ticket.findOneAndUpdate(
    {
      ticketNumber,
      currentStatus // Atomic concurrency lock
    },
    {
      $set: {
        currentStatus: newStatus,
        timeline: updatedTimeline
      }
    },
    { new: true }
  );

  if (!updatedTicket) {
    throw new ApiError(409, 'Ticket status has been concurrently modified. Please reload and retry.');
  }

  // 6. Mirror status update and action onto all linked reports
  if (updatedTicket.reportIds && updatedTicket.reportIds.length > 0) {
    const actionMessage = note
      ? `Ticket ${ticketNumber} status updated to ${newStatus} by ${actor.name} (${actor.role}): ${note}`
      : `Ticket ${ticketNumber} status updated to ${newStatus} by ${actor.name} (${actor.role})`;

    await Report.updateMany(
      { reportId: { $in: updatedTicket.reportIds } },
      {
        $set: { status: newStatus },
        $push: {
          actionsTaken: {
            timestamp: now,
            action: actionMessage
          }
        }
      }
    );
  }

  // Write audit trail entry
  logAudit({
    action: 'STATUS_CHANGED',
    relatedRecord: ticketNumber,
    user: `${actor.name} (${actor.id})`,
    role: actor.role,
    description: `Ticket status transitioned from ${currentStatus} to ${newStatus}${note ? ': ' + note : ''}`
  });

  // Announce the status change (after everything is saved)
  safeEmit('ticket.statusChanged', {
    ticketNumber,
    from: currentStatus,
    to: newStatus,
    by: actor.id
  });

  return updatedTicket;
};

/**
 * Assigns or reassigns a ticket to a municipal department and field officer.
 * Allowed roles: authority, admin.
 * Allowed from: Reported, Verified, Under Review, Escalated, Reopened - Under Investigation, or Assigned.
 * 
 * @param {string} ticketNumber
 * @param {Object} assignData - { department, officerId, officerName, designation, contact, priority, directives }
 * @param {Object} actor - Caller identity
 * @returns {Promise<Object>} - Updated ticket
 */
const assignTicket = async (ticketNumber, assignData, actor) => {
  if (!actor.isAuthority) {
    throw new ApiError(403, `Role '${actor.role}' cannot assign tickets (requires authority or admin)`);
  }

  const ticket = await Ticket.findOne({ ticketNumber: ticketNumber.toUpperCase() });
  if (!ticket) {
    throw new ApiError(404, `Ticket with number '${ticketNumber}' not found`);
  }

  // Check allowed statuses for assignment
  const ALLOWED_ASSIGN_STATUSES = [
    'Reported',
    'Verified',
    'Under Review',
    'Escalated',
    'Reopened - Under Investigation',
    'Assigned'
  ];

  if (!ALLOWED_ASSIGN_STATUSES.includes(ticket.currentStatus)) {
    throw new ApiError(409, `Cannot assign ticket in '${ticket.currentStatus}' status`);
  }

  // Apply assignment details
  ticket.assignedOfficerId = assignData.officerId;
  ticket.assignedAuthority = {
    name: assignData.officerName,
    designation: assignData.designation || '',
    department: assignData.department,
    contact: assignData.contact || ''
  };

  let newDeadline;
  if (assignData.priority) {
    ticket.urgencyLevel = assignData.priority;
    newDeadline = calculateExpectedResolutionDate(assignData.priority, ticket.submissionDate);
    ticket.expectedResolutionDate = newDeadline;
  }

  await ticket.save();

  // Mirror assigned department & officer to linked reports
  const reportUpdates = {
    assignedDepartment: assignData.department,
    assignedOfficer: assignData.officerName
  };
  if (assignData.priority) {
    reportUpdates.severity = assignData.priority;
    reportUpdates.slaTargetDate = newDeadline;
  }
  await Report.updateMany(
    { reportId: { $in: ticket.reportIds } },
    { $set: reportUpdates }
  );

  // If already Assigned, record new assignment in timeline without transition error
  if (ticket.currentStatus === 'Assigned') {
    const stage = ticket.timeline.find((s) => s.stage === 'Assigned');
    if (stage) {
      stage.completed = true;
      stage.date = new Date();
      stage.officer = assignData.officerName;
      if (assignData.directives) stage.description = assignData.directives;
    }
    await ticket.save();

    await Report.updateMany(
      { reportId: { $in: ticket.reportIds } },
      {
        $push: {
          actionsTaken: {
            timestamp: new Date(),
            action: `Reassigned to ${assignData.officerName} (${assignData.department}) by ${actor.name}`
          }
        }
      }
    );

       safeEmit('ticket.assigned', {
      ticketNumber: ticket.ticketNumber,
      officerId: assignData.officerId
    });
    return ticket;
  }

  // Otherwise, transition to Assigned status via applyStatusChange

    const assignedTicket = await applyStatusChange(
    ticket,
    'Assigned',
    actor,
    assignData.directives || `Assigned to ${assignData.officerName} (${assignData.department})`
  );

  safeEmit('ticket.assigned', {
    ticketNumber: assignedTicket.ticketNumber,
    officerId: assignData.officerId
  });

  logAudit({
    action: 'TICKET_ASSIGNED',
    relatedRecord: assignedTicket.ticketNumber,
    user: `${actor.name} (${actor.id})`,
    role: actor.role,
    description: `Ticket assigned to officer ${assignData.officerName} (${assignData.department})`
  });

  return assignedTicket;
};

/**
 * Handles field officer inspection actions (start, remarks, mark in progress, photos, completion).
 * Allowed role: field_officer (must be assigned to this ticket).
 * 
 * @param {string} ticketNumber
 * @param {Object} actionData - { action, remarks, photoUrl, note }
 * @param {Object} actor - Caller identity
 * @returns {Promise<Object>} - Updated ticket
 */
const performInspectionAction = async (ticketNumber, actionData, actor) => {
  if (actor.role !== 'field_officer') {
    throw new ApiError(403, `Role '${actor.role}' cannot perform inspection actions (field_officer required)`);
  }

  const ticket = await Ticket.findOne({ ticketNumber: ticketNumber.toUpperCase() });
  if (!ticket) {
    throw new ApiError(404, `Ticket with number '${ticketNumber}' not found`);
  }

  // Enforce ticket ownership
  if (ticket.assignedOfficerId !== actor.id) {
    throw new ApiError(403, `Field officer '${actor.name}' (${actor.id}) is not assigned to this ticket`);
  }

  const { action, remarks, photoUrl, note } = actionData;
  const now = new Date();

  switch (action) {
    case 'start_inspection': {
      if (ticket.currentStatus !== 'Assigned') {
        throw new ApiError(409, `Inspection can only be started when ticket is Assigned (current status: ${ticket.currentStatus})`);
      }
      ticket.inspection.startedAt = now;
      const stage = ticket.timeline.find((s) => s.stage === 'Field Inspection');
      if (stage) {
        stage.completed = true;
        stage.date = now;
        stage.officer = actor.name;
        if (note) stage.description = note;
      }
      await ticket.save();
      return ticket;
    }

    case 'submit_remarks': {
      if (!ticket.inspection || !ticket.inspection.startedAt) {
        throw new ApiError(409, 'Cannot submit remarks: inspection has not been started yet');
      }
      if (!remarks || remarks.trim() === '') {
        throw new ApiError(400, 'Remarks cannot be empty');
      }
      ticket.inspection.remarks = remarks.trim();
      await ticket.save();
      return ticket;
    }

    case 'mark_in_progress': {
      if (!ticket.inspection || !ticket.inspection.startedAt) {
        throw new ApiError(409, 'Cannot mark in progress: inspection has not been started yet');
      }
      if (ticket.currentStatus !== 'Assigned') {
        throw new ApiError(409, `Ticket can only be marked in progress from Assigned status (current status: ${ticket.currentStatus})`);
      }
      return applyStatusChange(ticket, 'In Progress', actor, note || 'Field repair operations in progress');
    }

    case 'upload_before_photo': {
      if (!photoUrl || photoUrl.trim() === '') {
        throw new ApiError(400, 'photoUrl is required for upload_before_photo');
      }
      ticket.inspection.beforePhotoUrl = photoUrl.trim();
      await ticket.save();
      return ticket;
    }

    case 'upload_after_photo': {
      if (!photoUrl || photoUrl.trim() === '') {
        throw new ApiError(400, 'photoUrl is required for upload_after_photo');
      }
      if (ticket.currentStatus !== 'In Progress') {
        throw new ApiError(409, `After photo can only be uploaded when ticket is In Progress (current status: ${ticket.currentStatus})`);
      }
      ticket.inspection.afterPhotoUrl = photoUrl.trim();
      await ticket.save();
      return ticket;
    }

    case 'submit_completion': {
      if (!ticket.inspection || !ticket.inspection.afterPhotoUrl) {
        throw new ApiError(409, 'Cannot submit completion without an after-repair photo');
      }
      if (ticket.currentStatus !== 'In Progress') {
        throw new ApiError(409, `Completion can only be submitted when ticket is In Progress (current status: ${ticket.currentStatus})`);
      }
      ticket.inspection.completionNote = note || remarks || 'Work completed successfully';
      ticket.inspection.completedAt = now;
      await ticket.save();
      return applyStatusChange(ticket, 'Resolved', actor, note || 'Repair completed and submitted for verification');
    }

    default:
      throw new ApiError(400, `Unknown inspection action: '${action}'`);
  }
};

/**
 * Handles citizen resolution confirmation or dispute.
 * Allowed role: citizen.
 * Only allowed when ticket is in 'Resolved' status.
 * 
 * @param {string} ticketNumber
 * @param {Object} confirmData - { decision: 'confirm' | 'dispute', comment }
 * @param {Object} actor - Caller identity
 * @returns {Promise<Object>} - Updated ticket
 */
const confirmTicket = async (ticketNumber, confirmData, actor) => {
  if (actor.role !== 'citizen') {
    throw new ApiError(403, `Role '${actor.role}' cannot confirm or dispute tickets (citizen required)`);
  }

  const ticket = await Ticket.findOne({ ticketNumber: ticketNumber.toUpperCase() });
  if (!ticket) {
    throw new ApiError(404, `Ticket with number '${ticketNumber}' not found`);
  }

  // Ensure only the citizen who lodged the grievance can confirm or dispute
  if (ticket.createdBy && ticket.createdBy !== actor.id) {
    throw new ApiError(403, 'Only the citizen who lodged this grievance can confirm or dispute resolution');
  }

  if (ticket.currentStatus !== 'Resolved') {
    throw new ApiError(409, `Cannot confirm or dispute: ticket is in '${ticket.currentStatus}' status (must be Resolved)`);
  }

  const { decision, comment } = confirmData;

  if (decision === 'confirm') {
    return applyStatusChange(
      ticket,
      'Citizen-Confirmed',
      actor,
      comment || 'Citizen verified and confirmed resolution'
    );
  }

  if (decision === 'dispute') {
    if (!comment || comment.trim() === '') {
      throw new ApiError(400, 'Comment is required when disputing resolution');
    }
    return applyStatusChange(
      ticket,
      'Reopened - Under Investigation',
      actor,
      comment.trim()
    );
  }

  throw new ApiError(400, `Invalid decision: '${decision}' (must be confirm or dispute)`);
};

module.exports = {
  getTickets,
  getTicketByNumber,
  applyStatusChange,
  assignTicket,
  performInspectionAction,
  confirmTicket
};
