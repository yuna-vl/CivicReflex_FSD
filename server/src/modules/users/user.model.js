/**
 * src/modules/users/user.model.js
 * 
 * Purpose:
 * Mongoose schema and model for application users.
 * Supports RBAC (citizen, authority, field_officer, admin), account suspension,
 * human-readable userCode (e.g. USR-1001), and secure password/refresh-token storage.
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // Unique human-readable code (e.g. USR-1001)
    userCode: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },

    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false
    },

    role: {
      type: String,
      enum: ['citizen', 'authority', 'field_officer', 'admin'],
      default: 'citizen'
    },

    designation: {
      type: String,
      trim: true
    },

    department: {
      type: String,
      trim: true
    },

    ward: {
      type: String,
      trim: true
    },

    phone: {
      type: String,
      trim: true
    },

    badgeNumber: {
      type: String,
      trim: true
    },

    memberSince: {
      type: Date,
      default: Date.now
    },

    accountStatus: {
      type: String,
      enum: ['Active', 'Suspended'],
      default: 'Active'
    },

    suspensionReason: {
      type: String,
      trim: true
    },

    trustScore: {
      type: Number,
      default: 0
    },

    refreshTokenHash: {
      type: String,
      select: false
    },

    // Login lockout tracking (Part 5)
    failedLoginAttempts: {
      type: Number,
      default: 0
    },

    lockUntil: {
      type: Date
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
userSchema.index({ role: 1, accountStatus: 1 });
userSchema.index({ name: 'text', email: 'text', phone: 'text', ward: 'text', userCode: 'text' });

// Ensure password and refresh token are omitted from JSON outputs
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret.userCode;
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    delete ret.__v;
    return ret;
  }
});

userSchema.set('toObject', {
  transform: (doc, ret) => {
    ret.id = ret.userCode;
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    delete ret.__v;
    return ret;
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
