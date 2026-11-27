/**
 * src/modules/audit/auditLog.model.js
 * 
 * Purpose:
 * Tamper-evident append-only audit trail model using SHA-256 cryptographic chain.
 * Matches frontend audit log fields and guarantees traceability.
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    auditId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    },

    action: {
      type: String,
      required: true,
      trim: true
    },

    relatedRecord: {
      type: String,
      trim: true
    },

    // Formatted as "Name (userCode)" e.g. "Suresh Kumar (USR-1002)"
    user: {
      type: String,
      required: true,
      trim: true
    },

    role: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      required: true,
      trim: true
    },

    // Cryptographic hash chain
    prevHash: {
      type: String,
      required: true
    },

    hash: {
      type: String,
      required: true
    },
    // Flag indicating seeded demo data
    isSeed: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Indexes
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ role: 1, action: 1 });
auditLogSchema.index({ relatedRecord: 1 });

auditLogSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret.auditId;
    delete ret.__v;
    return ret;
  }
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
