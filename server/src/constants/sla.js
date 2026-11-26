/**
 * src/constants/sla.js
 * 
 * Purpose:
 * Service Level Agreement (SLA) turnaround thresholds by report severity.
 * Reads configured hours dynamically from Settings with fallback to default operational windows.
 */

let cachedSettings = {
  highSlaHours: 24,
  mediumSlaHours: 48,
  lowSlaHours: 120
};

const setCachedSlaHours = (newSettings) => {
  if (newSettings) {
    if (typeof newSettings.highSlaHours === 'number') cachedSettings.highSlaHours = newSettings.highSlaHours;
    if (typeof newSettings.mediumSlaHours === 'number') cachedSettings.mediumSlaHours = newSettings.mediumSlaHours;
    if (typeof newSettings.lowSlaHours === 'number') cachedSettings.lowSlaHours = newSettings.lowSlaHours;
  }
};

const getSlaHours = (severity = 'Medium', customSettings = cachedSettings) => {
  switch (severity) {
    case 'Critical':
    case 'High':
      return customSettings.highSlaHours ?? 24;
    case 'Medium':
      return customSettings.mediumSlaHours ?? 48;
    case 'Low':
      return customSettings.lowSlaHours ?? 120;
    default:
      return customSettings.mediumSlaHours ?? 48;
  }
};

/**
 * Computes target completion deadline based on severity and initial report date
 * @param {string} [severity='Medium'] - 'Critical' | 'High' | 'Medium' | 'Low'
 * @param {Date} [submissionDate=new Date()]
 * @param {Object} [customSettings]
 * @returns {Date}
 */
const calculateExpectedResolutionDate = (severity = 'Medium', submissionDate = new Date(), customSettings) => {
  const hours = getSlaHours(severity, customSettings);
  return new Date(submissionDate.getTime() + hours * 60 * 60 * 1000);
};

module.exports = {
  SLA_HOURS_BY_SEVERITY: {
    Critical: 24,
    High: 24,
    Medium: 48,
    Low: 120
  },
  getSlaHours,
  setCachedSlaHours,
  calculateExpectedResolutionDate
};
