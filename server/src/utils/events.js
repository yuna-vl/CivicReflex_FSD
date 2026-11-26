// An "announcement board". When something happens (like a report being created),
// the code announces it here. Other code can listen without touching your code.

const { EventEmitter } = require('events');

const events = new EventEmitter();

// A safe way to announce. If a listener breaks, the API still works.
function safeEmit(name, payload) {
  try {
    for (const listener of events.rawListeners(name)) {
      try {
        const result = listener.call(events, payload);
        // If the listener is async and fails, catch it so the server doesn't crash.
        if (result && typeof result.catch === 'function') {
          result.catch((err) =>
            console.error(`[events] async listener for "${name}" failed:`, err.message)
          );
        }
      } catch (err) {
        console.error(`[events] listener for "${name}" failed:`, err.message);
      }
    }
  } catch (err) {
    console.error(`[events] could not emit "${name}":`, err.message);
  }
}

module.exports = { events, safeEmit };