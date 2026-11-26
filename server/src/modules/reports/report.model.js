/**
 * src/modules/reports/report.model.js
 * 
 * Purpose:
 * Mongoose schema and model definition for citizen civic reports.
 * Matches the frontend data schema and provides indexes for performance,
 * geospatial queries, and idempotency guarantees.
 */

const mongoose = require('mongoose');
const { REPORT_STATUSES, DEFAULT_STATUS } = require('../../constants/statuses');

// Sub-schema for GeoJSON Point (optional location coordinates)
const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    // GeoJSON coordinates format: [longitude, latitude]
    coordinates: {
      type: [Number],
      required: true
    }
  },
  { _id: false }
);

// Sub-schema for tracking chronological audit trail of actions taken on a report
const actionTakenSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now
    },
    action: {
      type: String,
      required: true,
      trim: true
    }
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    // Unique human-readable identifier (e.g. REP-2026-1001)
    reportId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    // Associated civic grievance ticket number (e.g. CR-2026-9001)
    ticketNumber: {
      type: String,
      trim: true
    },

    // Type of report: civic issue vs citizen experience
    type: {
      type: String,
      enum: ['issue', 'experience'],
      default: 'issue'
    },

    // Core grievance details (Required)
    title: {
      type: String,
      required: [true, 'Report title is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true
    },
    subcategory: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true
    },

    // Location & administrative boundaries
    location: {
      type: String,
      trim: true
    },
    zone: {
      type: String,
      trim: true
    },
    wardNumber: {
      type: String,
      required: [true, 'Ward number is required (e.g. Ward 14)'],
      trim: true
    },
    landmark: {
      type: String,
      trim: true
    },

    // Optional GeoJSON geospatial location
    geo: {
      type: pointSchema,
      required: false
    },

    // Media & status
    photoUrl: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: DEFAULT_STATUS
    },
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium'
    },

    // Citizen engagement & verification
    upvotes: {
      type: Number,
      default: 0
    },
    verifiedCount: {
      type: Number,
      default: 0
    },
    verifiedBy: {
      type: [String],
      default: []
    },
    isAnonymous: {
      type: Boolean,
      default: false
    },
    timeOfDay: {
      type: String,
      trim: true
    },
    reportedAt: {
      type: Date,
      default: Date.now
    },

    // Official handling & SLA tracking
    actionsTaken: {
      type: [actionTakenSchema],
      default: []
    },
    assignedDepartment: {
      type: String,
      trim: true
    },
    assignedOfficer: {
      type: String,
      trim: true
    },
    slaTargetDate: {
      type: Date
    },

    // User reference (creator userCode e.g. USR-1001)
    createdBy: {
      type: String,
      trim: true
    },

    // Moderation & Flagging (Part 4)
    isFlagged: {
      type: Boolean,
      default: false
    },
    flagReason: {
      type: String,
      trim: true
    },
    moderationStatus: {
      type: String,
      enum: ['None', 'Pending', 'Approved', 'Rejected', 'Duplicate', 'Clarification Requested', 'Escalated'],
      default: 'None'
    },
    moderationHistory: {
      type: [
        new mongoose.Schema(
          {
            action: { type: String, required: true },
            by: { type: String, required: true },
            reason: { type: String },
            duplicateOf: { type: String },
            at: { type: Date, default: Date.now }
          },
          { _id: false }
        )
      ],
      default: []
    },

    // Client idempotency key for preventing duplicate submissions
    idempotencyKey: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
// 1. 2dsphere index for geospatial proximity queries
reportSchema.index({ geo: '2dsphere' });

// 2. Compound index for common query filtering and sorting
reportSchema.index({ wardNumber: 1, status: 1, reportedAt: -1 });

// 3. Unique sparse index on idempotency key to prevent duplicate submissions
reportSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

// Customize JSON representation: expose reportId as `id`, hide internal/system fields, and anonymize when requested
const transformReport = (doc, ret, options) => {
  ret.id = ret.reportId;
  delete ret.__v;

  // Authorities and admins can view unblurred data with full audit metadata
  if (options && options.isAuthority) {
    return ret;
  }

  delete ret.idempotencyKey;
  delete ret.verifiedBy;

  if (ret.isAnonymous) {
    delete ret.createdBy;
    if (typeof ret.latitude === 'number') {
      ret.latitude = Math.round(ret.latitude * 100) / 100;
    }
    if (typeof ret.longitude === 'number') {
      ret.longitude = Math.round(ret.longitude * 100) / 100;
    }
    if (ret.geo && Array.isArray(ret.geo.coordinates)) {
      ret.geo = {
        ...ret.geo,
        coordinates: ret.geo.coordinates.map((c) =>
          typeof c === 'number' ? Math.round(c * 100) / 100 : c
        )
      };
    }
  }

  return ret;
};

reportSchema.set('toJSON', {
  transform: transformReport
});

reportSchema.set('toObject', {
  transform: transformReport
});

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
