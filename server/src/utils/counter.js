/**
 * src/utils/counter.js
 * 
 * Purpose:
 * Provides an atomic sequence generator using MongoDB's `findOneAndUpdate`.
 * Guaranteed to generate unique, strictly incrementing numbers starting at 1001,
 * preventing race conditions even when multiple requests arrive concurrently.
 * This is reused for report IDs and later for grievance tickets.
 */

const mongoose = require('mongoose');

// Schema for tracking sequential numbers per counter name
const counterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  seq: {
    type: Number,
    default: 0
  }
});

const Counter = mongoose.model('Counter', counterSchema);

/**
 * Atomically increments and returns the next sequence number for a given name.
 * Numbers start at 1001.
 * 
 * @param {string} name - Identifier for the counter (e.g. 'reports', 'tickets')
 * @returns {Promise<number>} - Next unique sequence number
 */
const nextSequence = async (name) => {
  // Atomically increment the sequence counter, creating the document if it doesn't exist
  let counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  // If this counter was newly initialized (seq was 1), offset it to start at 1001
  if (counter.seq < 1001) {
    counter = (await Counter.findOneAndUpdate(
      { name, seq: { $lt: 1001 } },
      { $set: { seq: 1001 } },
      { new: true }
    )) || counter;
  }

  return counter.seq;
};

module.exports = {
  Counter,
  nextSequence
};

