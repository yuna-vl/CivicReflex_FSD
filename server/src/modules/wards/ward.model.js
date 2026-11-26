/**
 * src/modules/wards/ward.model.js
 * 
 * Purpose:
 * Mongoose schema and model for municipal administrative wards.
 */

const mongoose = require('mongoose');

const wardSchema = new mongoose.Schema(
  {
    wardNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    wardName: {
      type: String,
      required: true,
      trim: true
    },
    zone: {
      type: String,
      required: true,
      trim: true
    },
    assignedAuthority: {
      type: String,
      trim: true
    },
    fieldOfficers: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'
    }
  },
  {
    timestamps: true
  }
);

wardSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret.wardNumber;
    delete ret.__v;
    return ret;
  }
});

const Ward = mongoose.model('Ward', wardSchema);

module.exports = Ward;
