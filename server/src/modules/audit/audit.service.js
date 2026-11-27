/**
 * src/modules/audit/audit.service.js
 * 
 * Purpose:
 * Service layer for logging audit entries through a single serialized queue.
 * Calculates cryptographic SHA-256 hash chains (prevHash + content -> hash),
 * provides verification to identify broken records, and generates CSV exports.
 */

const crypto = require('crypto');
const AuditLog = require('./auditLog.model');
const { nextSequence } = require('../../utils/counter');

const GENESIS_HASH = '0'.repeat(64);

// In-process serialized FIFO queue
let auditQueue = Promise.resolve();

/**
 * Computes SHA-256 hash for an audit record given its previous hash
 */
const computeHash = (prevHash, auditId, timestamp, action, relatedRecord, user, role, description) => {
  const timeStr = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString();
  const payload = [
    prevHash,
    auditId,
    timeStr,
    action || '',
    relatedRecord || '',
    user || '',
    role || '',
    description || ''
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
};

/**
 * Internal worker to save an audit entry atomically in queue
 */
const _writeAuditEntry = async ({ action, relatedRecord, user, role, description }) => {
  const now = new Date();
  const year = now.getFullYear();
  const seq = await nextSequence('audit', 1001);
  const auditId = `AUD-${year}-${seq}`;

  // Find previous latest audit log entry
  const latest = await AuditLog.findOne().sort({ timestamp: -1, _id: -1 });
  const prevHash = latest ? latest.hash : GENESIS_HASH;

  const hash = computeHash(
    prevHash,
    auditId,
    now,
    action,
    relatedRecord,
    user,
    role,
    description
  );

  const newLog = new AuditLog({
    auditId,
    timestamp: now,
    action,
    relatedRecord: relatedRecord || '',
    user: user || 'System (SYS-0000)',
    role: role || 'system',
    description: description || '',
    prevHash,
    hash
  });

  return newLog.save();
};

/**
 * Safe external audit logger that never throws into caller requests
 */
const logAudit = (params) => {
  auditQueue = auditQueue
    .then(() => _writeAuditEntry(params))
    .catch((err) => {
      console.error('[AuditLog Failure] Could not persist audit entry:', err.message);
    });
  return auditQueue;
};

/**
 * Retrieves paginated audit logs with search and filtering
 */
const getAuditLogs = async (queryParams) => {
  const { role, action, q, page: rawPage, limit: rawLimit } = queryParams;

  const page = parseInt(rawPage, 10) > 0 ? parseInt(rawPage, 10) : 1;
  const limit = parseInt(rawLimit, 10) > 0 ? Math.min(parseInt(rawLimit, 10), 100) : 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (role) filter.role = role;
  if (action) filter.action = action;
  if (q && q.trim()) {
    const regex = new RegExp(q.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
    filter.$or = [{ relatedRecord: regex }, { user: regex }, { description: regex }];
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ timestamp: -1, _id: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter)
  ]);

  return { items, page, limit, total };
};

/**
 * Exports audit logs as a CSV formatted string (Part 5)
 */
const exportAuditLogsCsv = async (queryParams) => {
  const { role, action, q } = queryParams;
  const filter = {};
  if (role) filter.role = role;
  if (action) filter.action = action;
  if (q && q.trim()) {
    const regex = new RegExp(q.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
    filter.$or = [{ relatedRecord: regex }, { user: regex }, { description: regex }];
  }

  const logs = await AuditLog.find(filter).sort({ timestamp: -1, _id: -1 });

  const headers = ['auditId', 'timestamp', 'action', 'relatedRecord', 'user', 'role', 'description', 'prevHash', 'hash'];
  const escapeCsv = (str) => `"${String(str ?? '').replace(/"/g, '""')}"`;

  const rows = logs.map((log) => [
    escapeCsv(log.auditId),
    escapeCsv(log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp),
    escapeCsv(log.action),
    escapeCsv(log.relatedRecord),
    escapeCsv(log.user),
    escapeCsv(log.role),
    escapeCsv(log.description),
    escapeCsv(log.prevHash),
    escapeCsv(log.hash)
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
};

/**
 * Re-computes the entire cryptographic chain to verify integrity
 */
const verifyChain = async () => {
  const logs = await AuditLog.find().sort({ timestamp: 1, createdAt: 1, _id: 1 });

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];

    // Check link with previous block
    if (entry.prevHash !== expectedPrevHash) {
      return {
        status: 'broken',
        brokenAuditId: entry.auditId,
        index: i,
        reason: `Previous hash mismatch: expected '${expectedPrevHash}', found '${entry.prevHash}'`
      };
    }

    // Recompute current hash
    const expectedHash = computeHash(
      entry.prevHash,
      entry.auditId,
      entry.timestamp,
      entry.action,
      entry.relatedRecord,
      entry.user,
      entry.role,
      entry.description
    );

    if (entry.hash !== expectedHash) {
      return {
        status: 'broken',
        brokenAuditId: entry.auditId,
        index: i,
        reason: `Hash mismatch: expected '${expectedHash}', found '${entry.hash}'`
      };
    }

    expectedPrevHash = entry.hash;
  }

  return {
    status: 'intact',
    count: logs.length
  };
};

module.exports = {
  logAudit,
  getAuditLogs,
  exportAuditLogsCsv,
  verifyChain
};
