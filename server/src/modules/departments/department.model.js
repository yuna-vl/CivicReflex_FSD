/**
 * src/modules/departments/department.model.js
 * 
 * Purpose:
 * Mongoose schema and model definition for municipal departments responsible
 * for resolving citizen grievances (e.g. Roads, Solid Waste, Streetlights).
 */

const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true
    },
    code: {
      type: String,
      required: [true, 'Department code is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    nodalOfficer: {
      type: String,
      trim: true
    },
    officerCount: {
      type: Number,
      default: 0
    },
    budgetAllocated: {
      type: String,
      trim: true
    },
    contactEmail: {
      type: String,
      trim: true
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

// Format JSON response: expose id and remove internal version __v
departmentSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

departmentSchema.set('toObject', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

const Department = mongoose.model('Department', departmentSchema);

module.exports = Department;

