/**
 * src/constants/sla.js
 * 
 * Purpose:
 * Service Level Agreement (SLA) turnaround thresholds by report severity.
 * Defines standard resolution windows in hours matching the frontend's default settings.
 */

// TODO: read these from admin settings in feature/auth-admin
const SLA_HOURS_BY_SEVERITY = {
  Critical: 24,
  High: 24,
  Medium: 48,
  Low: 120
};

/**
 * Computes target completion deadline based on severity and initial report date
 * @param {string} [severity='Medium'] - 'Critical' | 'High' | 'Medium' | 'Low'
 * @param {Date} [submissionDate=new Date()]
 * @returns {Date}
 */
const calculateExpectedResolutionDate = (severity = 'Medium', submissionDate = new Date()) => {
  const hours = SLA_HOURS_BY_SEVERITY[severity] || SLA_HOURS_BY_SEVERITY.Medium;
  return new Date(submissionDate.getTime() + hours * 60 * 60 * 1000);
};

module.exports = {
  SLA_HOURS_BY_SEVERITY,
  calculateExpectedResolutionDate
};

