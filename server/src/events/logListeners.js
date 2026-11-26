// Prints one short line in the terminal each time an event happens,
// so you can see the events working.

const { events } = require('../utils/events');

let registered = false;

function registerLogListeners() {
  if (registered) return; // make sure we only do this once
  registered = true;

  events.on('report.created', ({ reportId, ticketNumber }) =>
    console.log(`[event] report.created report=${reportId} ticket=${ticketNumber}`));

  events.on('report.verified', ({ reportId, userId, verifiedCount }) =>
    console.log(`[event] report.verified report=${reportId} user=${userId} count=${verifiedCount}`));

  events.on('ticket.assigned', ({ ticketNumber, officerId }) =>
    console.log(`[event] ticket.assigned ticket=${ticketNumber} officer=${officerId}`));

  events.on('ticket.statusChanged', ({ ticketNumber, from, to, by }) =>
    console.log(`[event] ticket.statusChanged ticket=${ticketNumber} ${from} -> ${to} by=${by}`));
}

module.exports = { registerLogListeners };