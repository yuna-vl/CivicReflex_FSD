/**
 * src/modules/categories/category.model.js
 * 
 * Purpose:
 * Mongoose schema and model for civic grievance issue categories and SLA configurations.
 */

const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    department: {
      type: String,
      required: true,
      trim: true
    },
    defaultPriority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium'
    },
    defaultSlaHours: {
      type: Number,
      default: 48
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'
    },
    description: {
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

categorySchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
