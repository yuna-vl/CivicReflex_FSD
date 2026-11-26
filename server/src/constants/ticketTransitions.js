/**
 * src/constants/ticketTransitions.js
 * 
 * Purpose:
 * Canonical state machine defining allowed ticket status transitions by actor role.
 * Enforces municipal workflow rules and prevents invalid lifecycle jumps.
 */

// Mapping of allowed status transitions per role
// Treat 'admin' identically to 'authority'
const ALLOWED_TRANSITIONS = {
  'Reported': {
    authority: ['Verified', 'Under Review', 'Assigned', 'Escalated'],
    admin: ['Verified', 'Under Review', 'Assigned', 'Escalated']
  },
  'Verified': {
    authority: ['Verified', 'Under Review', 'Assigned', 'Escalated'],
    admin: ['Verified', 'Under Review', 'Assigned', 'Escalated']
  },
  'Under Review': {
    authority: ['Verified', 'Under Review', 'Assigned', 'Escalated'],
    admin: ['Verified', 'Under Review', 'Assigned', 'Escalated']
  },
  'Assigned': {
    field_officer: ['In Progress'],
    authority: ['Escalated', 'Assigned'],
    admin: ['Escalated', 'Assigned']
  },
  'In Progress': {
    field_officer: ['Resolved'],
    authority: ['Escalated'],
    admin: ['Escalated']
  },
  'Resolved': {
    citizen: ['Citizen-Confirmed', 'Reopened - Under Investigation']
  },
  'Reopened - Under Investigation': {
    authority: ['Assigned'],
    admin: ['Assigned']
  },
  'Escalated': {
    authority: ['Assigned', 'Under Review'],
    admin: ['Assigned', 'Under Review']
  },
  'Citizen-Confirmed': {}
};

/**
 * Checks whether a given transition is valid in the lifecycle and allowed for the role
 * @param {string} fromStatus - Current ticket status
 * @param {string} toStatus - Desired target status
 * @param {string} role - 'citizen' | 'authority' | 'field_officer' | 'admin'
 * @returns {{ isLifecycleValid: boolean, isRoleAllowed: boolean }}
 */
const checkTransition = (fromStatus, toStatus, role) => {
  const transitionsForState = ALLOWED_TRANSITIONS[fromStatus] || {};

  // Check if toStatus is a valid target from fromStatus for ANY role in the lifecycle
  const allPossibleTargets = Array.from(
    new Set(Object.values(transitionsForState).flat())
  );
  const isLifecycleValid = allPossibleTargets.includes(toStatus);

  // Check if role (with admin mapped to authority) is allowed
  const effectiveRole = role === 'admin' ? 'admin' : role;
  const roleTargets = transitionsForState[effectiveRole] || (role === 'admin' ? transitionsForState.authority || [] : []);
  const isRoleAllowed = roleTargets.includes(toStatus);

  return {
    isLifecycleValid,
    isRoleAllowed
  };
};

module.exports = {
  ALLOWED_TRANSITIONS,
  checkTransition
};

