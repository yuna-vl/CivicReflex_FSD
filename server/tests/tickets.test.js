/**
 * tests/tickets.test.js
 * 
 * Automated test suite covering Civic Grievance Tickets Lifecycle & State Machine:
 * 1. Full ticket lifecycle (Reported -> Assigned -> In Progress -> Resolved -> Citizen-Confirmed)
 * 2. Field officer cannot transition ticket to Citizen-Confirmed (403 Forbidden)
 * 3. Invalid lifecycle transition jump from Reported to Resolved is rejected (409 Conflict)
 * 4. Different field officer attempting to modify a ticket assigned to another officer is rejected (403 Forbidden)
 */

const { app, request, createTestUser } = require('./helpers');
const Ticket = require('../src/modules/tickets/ticket.model');

describe('Tickets API & State Transitions Automated Test Suite', () => {
  let citizen;
  let authority;
  let officerA;
  let officerB;

  beforeEach(async () => {
    citizen = await createTestUser('citizen');
    authority = await createTestUser('authority');
    officerA = await createTestUser('field_officer', { userCode: 'OFF-PWD-01' });
    officerB = await createTestUser('field_officer', { userCode: 'OFF-PWD-02' });
  });

  // Helper to create a report and get its linked ticket
  const createReportAndTicket = async (citizenUser = citizen) => {
    const reportRes = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${citizenUser.token}`)
      .send({
        title: 'Deep pothole on Ring Road',
        category: 'Road Damage / Potholes',
        description: 'Dangerous pothole requiring repair.',
        wardNumber: 'Ward 14'
      })
      .expect(201);

    const ticketNumber = reportRes.body.data.ticketNumber;
    return { report: reportRes.body.data, ticketNumber };
  };

  it('executes the full ticket lifecycle successfully', async () => {
    // Stage 1: Report created -> Ticket created in Reported status
    const { ticketNumber } = await createReportAndTicket();
    let ticket = await Ticket.findOne({ ticketNumber });
    expect(ticket.currentStatus).toBe('Reported');

    // Stage 2: Authority assigns ticket to Officer A
    const assignRes = await request(app)
      .post(`/api/tickets/${ticketNumber}/assign`)
      .set('Authorization', `Bearer ${authority.token}`)
      .send({
        department: 'Roads and Infrastructure',
        officerId: officerA.userCode,
        officerName: officerA.user.name
      })
      .expect(200);

    expect(assignRes.body.success).toBe(true);
    expect(assignRes.body.data.currentStatus).toBe('Assigned');
    expect(assignRes.body.data.assignedOfficerId).toBe(officerA.userCode);

    // Stage 3: Assigned officer marks ticket In Progress
    const inProgressRes = await request(app)
      .patch(`/api/tickets/${ticketNumber}/status`)
      .set('Authorization', `Bearer ${officerA.token}`)
      .send({
        status: 'In Progress',
        note: 'Site inspection conducted and repair work initiated'
      })
      .expect(200);

    expect(inProgressRes.body.data.currentStatus).toBe('In Progress');

    // Stage 4: Assigned officer marks ticket Resolved
    const resolvedRes = await request(app)
      .patch(`/api/tickets/${ticketNumber}/status`)
      .set('Authorization', `Bearer ${officerA.token}`)
      .send({
        status: 'Resolved',
        note: 'Bitumen patching completed successfully'
      })
      .expect(200);

    expect(resolvedRes.body.data.currentStatus).toBe('Resolved');

    // Stage 5: Grievance creator citizen confirms resolution
    const confirmRes = await request(app)
      .post(`/api/tickets/${ticketNumber}/confirm`)
      .set('Authorization', `Bearer ${citizen.token}`)
      .send({
        decision: 'confirm',
        comment: 'Verified on-site: pothole has been fully sealed'
      })
      .expect(200);

    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.data.currentStatus).toBe('Citizen-Confirmed');
  });

  it('rejects field officer attempting to set Citizen-Confirmed with 403 Forbidden', async () => {
    const { ticketNumber } = await createReportAndTicket();

    // Assign to officerA and move to Resolved
    await request(app)
      .post(`/api/tickets/${ticketNumber}/assign`)
      .set('Authorization', `Bearer ${authority.token}`)
      .send({
        department: 'Roads and Infrastructure',
        officerId: officerA.userCode,
        officerName: officerA.user.name
      });

    await request(app)
      .patch(`/api/tickets/${ticketNumber}/status`)
      .set('Authorization', `Bearer ${officerA.token}`)
      .send({ status: 'In Progress' });

    await request(app)
      .patch(`/api/tickets/${ticketNumber}/status`)
      .set('Authorization', `Bearer ${officerA.token}`)
      .send({ status: 'Resolved' });

    // Officer tries to transition to Citizen-Confirmed
    const res = await request(app)
      .patch(`/api/tickets/${ticketNumber}/status`)
      .set('Authorization', `Bearer ${officerA.token}`)
      .send({ status: 'Citizen-Confirmed' })
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/cannot move a ticket from Resolved to Citizen-Confirmed/i);
  });

  it('rejects direct transition jump from Reported to Resolved with 409 Conflict', async () => {
    const { ticketNumber } = await createReportAndTicket();

    // Attempting an illegal lifecycle jump from Reported directly to Resolved
    const res = await request(app)
      .patch(`/api/tickets/${ticketNumber}/status`)
      .set('Authorization', `Bearer ${authority.token}`)
      .send({ status: 'Resolved' })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/cannot transition ticket from 'Reported' to 'Resolved'/i);
  });

  it('rejects a different officer from modifying a ticket assigned to another officer with 403 Forbidden', async () => {
    const { ticketNumber } = await createReportAndTicket();

    // Assign ticket strictly to Officer A
    await request(app)
      .post(`/api/tickets/${ticketNumber}/assign`)
      .set('Authorization', `Bearer ${authority.token}`)
      .send({
        department: 'Roads and Infrastructure',
        officerId: officerA.userCode,
        officerName: officerA.user.name
      })
      .expect(200);

    // Officer B (unassigned) tries to update the status to In Progress
    const res = await request(app)
      .patch(`/api/tickets/${ticketNumber}/status`)
      .set('Authorization', `Bearer ${officerB.token}`)
      .send({ status: 'In Progress' })
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/not assigned to this ticket/i);
  });
});
