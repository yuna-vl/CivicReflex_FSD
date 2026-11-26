/**
 * src/modules/tickets/ticket.model.js
 * 
 * Purpose:
 * Mongoose schema and model definition for official civic grievance tickets.
 * Tracks operational resolution progress, assigned authorities, field inspections,
 * and chronological milestones.
 */

const mongoose = require('mongoose');
const { REPORT_STATUSES, DEFAULT_STATUS } = require('../../constants/statuses');

// Sub-schema for assigned municipal authority details
const assignedAuthoritySchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    designation: { type: String, trim: true },
    department: { type: String, trim: true },
    contact: { type: String, trim: true }
  },
  { _id: false }
);

// Sub-schema for individual progression stages in the ticket timeline
const timelineStageSchema = new mongoose.Schema(
  {
    stage: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    date: {
      type: Date,
      default: null
    },
    completed: {
      type: Boolean,
      default: false
    },
    officer: {
      type: String,
      trim: true,
      default: null
    }
  },
  { _id: false }
);

// Sub-schema for field officer inspection workflow
const inspectionSchema = new mongoose.Schema(
  {
    startedAt: {
      type: Date,
      default: null
    },
    remarks: {
      type: String,
      trim: true,
      default: null
    },
    beforePhotoUrl: {
      type: String,
      trim: true,
      default: null
    },
    afterPhotoUrl: {
      type: String,
      trim: true,
      default: null
    },
    completionNote: {
      type: String,
      trim: true,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    // Unique human-readable ticket number (format: CR-<year>-<number>, starting at 9001)
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    // Citizen report IDs linked to this ticket (e.g. ["REP-2026-1001"])
    reportIds: {
      type: [String],
      default: []
    },

    // Source of ticket creation
    source: {
      type: String,
      enum: ['manual', 'auto-escalated'],
      default: 'manual'
    },

    // Current resolution status
    currentStatus: {
      type: String,
      enum: REPORT_STATUSES,
      default: DEFAULT_STATUS
    },

    // Grievance classification and location details
    urgencyLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium'
    },
    ward: {
      type: String,
      required: [true, 'Ward is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true
    },
    issueType: {
      type: String,
      trim: true
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true
    },
    address: {
      type: String,
      trim: true
    },

    // Deadlines and scheduling
    submissionDate: {
      type: Date,
      default: Date.now
    },
    expectedResolutionDate: {
      type: Date
    },

    // Departmental assignment
    assignedOfficerId: {
      type: String,
      trim: true,
      default: null
    },
    assignedAuthority: {
      type: assignedAuthoritySchema,
      default: () => ({})
    },

    // Field officer inspection tracking
    inspection: {
      type: inspectionSchema,
      default: () => ({})
    },

    // Calculated priority score
    priorityScore: {
      type: Number,
      default: 0
    },

    // Citizen creator userCode
    createdBy: {
      type: String,
      trim: true
    },

    // Six-stage structured progression lifecycle
    timeline: {
      type: [timelineStageSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Indexes
ticketSchema.index({ currentStatus: 1, ward: 1 });

// Clean JSON serialization
ticketSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

ticketSchema.set('toObject', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
