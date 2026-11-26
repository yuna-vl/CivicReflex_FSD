/**
 * src/modules/settings/settings.model.js
 * 
 * Purpose:
 * Singleton settings document for municipal operations, SLA targets, and dispatch parameters.
 */

const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    portalName: {
      type: String,
      default: 'CivicReflex'
    },
    municipalCorporation: {
      type: String,
      default: 'Bruhat Bengaluru Mahanagara Palike'
    },
    helpline: {
      type: String,
      default: '1533'
    },
    portalUrl: {
      type: String,
      default: 'https://civicreflex.gov.in'
    },
    highSlaHours: {
      type: Number,
      default: 24
    },
    mediumSlaHours: {
      type: Number,
      default: 48
    },
    lowSlaHours: {
      type: Number,
      default: 120
    },
    autoEscalationDays: {
      type: Number,
      default: 3
    },
    duplicateGeoRadiusMeters: {
      type: Number,
      default: 15
    },
    autoQuarantineSpam: {
      type: Boolean,
      default: true
    },
    aiSpamSensitivity: {
      type: String,
      default: 'Standard'
    },
    enableSmsAlerts: {
      type: Boolean,
      default: true
    },
    enableEmailAlerts: {
      type: Boolean,
      default: true
    },
    dailyDigestTime: {
      type: String,
      default: '08:00 AM'
    }
  },
  {
    timestamps: true
  }
);

settingsSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
