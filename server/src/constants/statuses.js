/**
 * src/constants/statuses.js
 * 
 * Purpose:
 * Defines the canonical list of grievance and report statuses across CivicReflex.
 * Centralizing statuses prevents typos and ensures consistency between
 * data validation, database schemas, and API responses.
 */

const REPORT_STATUSES = [
  'Reported',
  'Verified',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Citizen-Confirmed',
  'Reopened - Under Investigation',
  'Escalated',
  'Rejected by Moderation',
  'Duplicate',
  'Clarification Requested'
];

module.exports = {
  REPORT_STATUSES,
  DEFAULT_STATUS: 'Reported'
};

