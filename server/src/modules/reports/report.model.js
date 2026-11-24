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

    // Citizen engagement & privacy
    upvotes: {
      type: Number,
      default: 0
    },
    verifiedCount: {
      type: Number,
      default: 0
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

    // User reference (optional, to be linked when authentication is added)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
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

// Customize JSON representation: expose reportId as `id` and remove `__v`
reportSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret.reportId;
    delete ret.__v;
    return ret;
  }
});

reportSchema.set('toObject', {
  transform: (doc, ret) => {
    ret.id = ret.reportId;
    delete ret.__v;
    return ret;
  }
});

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;

