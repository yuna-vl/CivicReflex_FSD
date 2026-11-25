/**
 * src/utils/counter.js
 * 
 * Purpose:
 * Provides an atomic sequence generator using MongoDB's `findOneAndUpdate`.
 * Guaranteed to generate unique, strictly incrementing numbers starting at a configurable base,
 * preventing race conditions even when multiple requests arrive concurrently.
 * Reused across report IDs (starts at 1001) and tickets (starts at 9001).
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
 * 
 * @param {string} name - Identifier for the counter (e.g. 'reports', 'tickets')
 * @param {number} [startingValue=1001] - Minimum baseline number to start the counter sequence
 * @returns {Promise<number>} - Next unique sequence number
 */
const nextSequence = async (name, startingValue = 1001) => {
  // Atomically increment the sequence counter, creating the document if it doesn't exist
  let counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  // If this counter was newly initialized (below startingValue), set it to startingValue
  if (counter.seq < startingValue) {
    counter = (await Counter.findOneAndUpdate(
      { name, seq: { $lt: startingValue } },
      { $set: { seq: startingValue } },
      { new: true }
    )) || counter;
  }

  return counter.seq;
};

module.exports = {
  Counter,
  nextSequence
};
