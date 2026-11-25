/**
 * server/test-suite-part-b.js
 * Comprehensive automated verification script for Tickets Part B.
 */

const mongoose = require('mongoose');
const { mongoUri, port } = require('./src/config/env');
const Report = require('./src/modules/reports/report.model');
const Ticket = require('./src/modules/tickets/ticket.model');

const SERVER_PORT = port || 5000;
const baseUrl = `http://localhost:${SERVER_PORT}/api`;

async function runTestSuite() {
  console.log(`Starting Tickets Part B test suite against ${baseUrl}...\n`);

  try {
    // =========================================================================
    // SCENARIO A: Happy path from Creation -> Assignment -> Inspection -> Confirmation
    // =========================================================================
    console.log('================================================================');
    console.log('SCENARIO A: Complete Resolution & Citizen Confirmation Flow');
    console.log('================================================================');

    // A.1 Create report
    console.log('\n--- A.1: Create Report ---');
    const rep1Req = {
      title: '[TEST] Clogged Culvert on 4th Main',
      category: 'Drainage & Waterlogging',
      subcategory: 'Culvert Blocked',
      description: 'Stormwater overflow due to clogged culvert under pedestrian bridge',
      wardNumber: 'Ward 12',
      location: '4th Main Road, Jayanagar',
      severity: 'High'
    };
    const resA1 = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rep1Req)
    });
    const dataA1 = await resA1.json();
    console.log('POST /api/reports Status:', resA1.status);
    const ticketA = dataA1.data?.ticketNumber;
    const reportAId = dataA1.data?.reportId;
    console.log(`Created Report: ${reportAId}, Ticket: ${ticketA}`);

    // A.2 Authority assigns ticket to officer "OFF-TEST-1"
    console.log(`\n--- A.2: Authority Assigns Ticket ${ticketA} to OFF-TEST-1 ---`);
    const assignReq = {
      department: 'Drainage Department',
      officerId: 'OFF-TEST-1',
      officerName: 'Suresh Kumar',
      designation: 'Assistant Executive Engineer',
      contact: '+91-9876500001',
      priority: 'High',
      directives: 'Clear culvert with desilting machine by evening'
    };
    const resA2 = await fetch(`${baseUrl}/tickets/${ticketA}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'authority',
        'x-actor-id': 'AUTH-HEAD-01',
        'x-actor-name': 'Commissioner Rao'
      },
      body: JSON.stringify(assignReq)
    });
    const dataA2 = await resA2.json();
    console.log(`POST /api/tickets/${ticketA}/assign Status:`, resA2.status);
    console.log('Ticket Status:', dataA2.data?.currentStatus);
    console.log('Assigned Officer:', dataA2.data?.assignedOfficerId, dataA2.data?.assignedAuthority?.name);

    // A.3 Officer runs start_inspection
    console.log(`\n--- A.3: Field Officer Starts Inspection ---`);
    const resA3 = await fetch(`${baseUrl}/tickets/${ticketA}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-1',
        'x-actor-name': 'Suresh Kumar'
      },
      body: JSON.stringify({ action: 'start_inspection', note: 'Arrived on site for preliminary assessment' })
    });
    const dataA3 = await resA3.json();
    console.log('start_inspection Status:', resA3.status);
    console.log('Inspection startedAt:', dataA3.data?.inspection?.startedAt);

    // A.4 Officer runs submit_remarks
    console.log(`\n--- A.4: Field Officer Submits Remarks ---`);
    const resA4 = await fetch(`${baseUrl}/tickets/${ticketA}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-1',
        'x-actor-name': 'Suresh Kumar'
      },
      body: JSON.stringify({ action: 'submit_remarks', remarks: 'Heavy silt and debris blocking water inflow' })
    });
    const dataA4 = await resA4.json();
    console.log('submit_remarks Status:', resA4.status);
    console.log('Remarks:', dataA4.data?.inspection?.remarks);

    // A.5 Officer runs mark_in_progress
    console.log(`\n--- A.5: Field Officer Marks In Progress ---`);
    const resA5 = await fetch(`${baseUrl}/tickets/${ticketA}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-1',
        'x-actor-name': 'Suresh Kumar'
      },
      body: JSON.stringify({ action: 'mark_in_progress', note: 'Desilting crane and 4 workers engaged' })
    });
    const dataA5 = await resA5.json();
    console.log('mark_in_progress Status:', resA5.status);
    console.log('Ticket Status:', dataA5.data?.currentStatus);

    // A.6 Officer runs upload_before_photo
    console.log(`\n--- A.6: Field Officer Uploads Before Photo ---`);
    const resA6 = await fetch(`${baseUrl}/tickets/${ticketA}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-1',
        'x-actor-name': 'Suresh Kumar'
      },
      body: JSON.stringify({ action: 'upload_before_photo', photoUrl: 'https://civicreflex.gov.in/photos/before_culvert.jpg' })
    });
    const dataA6 = await resA6.json();
    console.log('upload_before_photo Status:', resA6.status);
    console.log('beforePhotoUrl:', dataA6.data?.inspection?.beforePhotoUrl);

    // A.7 Officer runs upload_after_photo
    console.log(`\n--- A.7: Field Officer Uploads After Photo ---`);
    const resA7 = await fetch(`${baseUrl}/tickets/${ticketA}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-1',
        'x-actor-name': 'Suresh Kumar'
      },
      body: JSON.stringify({ action: 'upload_after_photo', photoUrl: 'https://civicreflex.gov.in/photos/after_culvert.jpg' })
    });
    const dataA7 = await resA7.json();
    console.log('upload_after_photo Status:', resA7.status);
    console.log('afterPhotoUrl:', dataA7.data?.inspection?.afterPhotoUrl);

    // A.8 Officer runs submit_completion
    console.log(`\n--- A.8: Field Officer Submits Completion ---`);
    const resA8 = await fetch(`${baseUrl}/tickets/${ticketA}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-1',
        'x-actor-name': 'Suresh Kumar'
      },
      body: JSON.stringify({ action: 'submit_completion', note: 'All silt cleared, water flowing smoothly' })
    });
    const dataA8 = await resA8.json();
    console.log('submit_completion Status:', resA8.status);
    console.log('Ticket Status:', dataA8.data?.currentStatus);
    console.log('Completed At:', dataA8.data?.inspection?.completedAt);

    // A.9 Citizen confirms resolution
    console.log(`\n--- A.9: Citizen Confirms Resolution ---`);
    const resA9 = await fetch(`${baseUrl}/tickets/${ticketA}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'citizen',
        'x-actor-id': 'CIT-ANANYA-01',
        'x-actor-name': 'Ananya Sharma'
      },
      body: JSON.stringify({ decision: 'confirm', comment: 'Inspected site myself, culvert is completely unclogged!' })
    });
    const dataA9 = await resA9.json();
    console.log('confirm Status:', resA9.status);
    console.log('Final Ticket Status:', dataA9.data?.currentStatus);

    // Verify report status has mirrored to Citizen-Confirmed
    const resRep = await fetch(`${baseUrl}/reports/${reportAId}`);
    const dataRep = await resRep.json();
    console.log('Report Status in DB:', dataRep.data?.status);
    console.log('Report Status is Citizen-Confirmed:', dataRep.data?.status === 'Citizen-Confirmed');

    console.log('\nFinal Ticket Timeline:');
    console.log(JSON.stringify(dataA9.data?.timeline, null, 2));


    // =========================================================================
    // SCENARIO B: Negative Cases & Security Rules
    // =========================================================================
    console.log('\n================================================================');
    console.log('SCENARIO B: Negative Cases & Security Constraints');
    console.log('================================================================');

    // Create a fresh report & ticket for negative cases
    const freshRes = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '[TEST] Fresh Ticket for Negative Test',
        category: 'Public Works',
        description: 'Testing lifecycle bounds',
        wardNumber: 'Ward 5'
      })
    });
    const freshData = await freshRes.json();
    const freshTicket = freshData.data?.ticketNumber;

    // B.1 Create a ticket in Resolved status to test: Officer tries to set Citizen-Confirmed (Expect 403)
    // To set up Resolved: assign, start inspection, mark in progress, upload after photo, submit completion
    await fetch(`${baseUrl}/tickets/${freshTicket}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'authority',
        'x-actor-id': 'AUTH-HEAD-01',
        'x-actor-name': 'Commissioner Rao'
      },
      body: JSON.stringify({
        department: 'Roads',
        officerId: 'OFF-TEST-1',
        officerName: 'Suresh Kumar'
      })
    });
    await fetch(`${baseUrl}/tickets/${freshTicket}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-1',
        'x-actor-name': 'Suresh Kumar'
      },
      body: JSON.stringify({ action: 'start_inspection' })
    });
    await fetch(`${baseUrl}/tickets/${freshTicket}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-1',
        'x-actor-name': 'Suresh Kumar'
      },
      body: JSON.stringify({ action: 'mark_in_progress' })
    });
    await fetch(`${baseUrl}/tickets/${freshTicket}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-1',
        'x-actor-name': 'Suresh Kumar'
      },
      body: JSON.stringify({ action: 'upload_after_photo', photoUrl: 'https://example.com/after.jpg' })
    });
    await fetch(`${baseUrl}/tickets/${freshTicket}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-1',
        'x-actor-name': 'Suresh Kumar'
      },
      body: JSON.stringify({ action: 'submit_completion' })
    });

    console.log('\n--- B.1: Officer tries to transition Resolved -> Citizen-Confirmed (Expect 403) ---');
    const resB1 = await fetch(`${baseUrl}/tickets/${freshTicket}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-1',
        'x-actor-name': 'Suresh Kumar'
      },
      body: JSON.stringify({ status: 'Citizen-Confirmed' })
    });
    const dataB1 = await resB1.json();
    console.log('Status:', resB1.status);
    console.log('Reply:', JSON.stringify(dataB1));

    // B.2 Authority tries Reported -> Resolved (Not allowed in lifecycle) -> 409
    const freshRes2 = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '[TEST] Fresh Ticket 2 for Invalid Jump',
        category: 'Public Works',
        description: 'Testing lifecycle bounds',
        wardNumber: 'Ward 5'
      })
    });
    const freshData2 = await freshRes2.json();
    const freshTicket2 = freshData2.data?.ticketNumber;

    console.log('\n--- B.2: Authority tries Reported -> Resolved (Expect 409) ---');
    const resB2 = await fetch(`${baseUrl}/tickets/${freshTicket2}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'authority',
        'x-actor-id': 'AUTH-HEAD-01',
        'x-actor-name': 'Commissioner Rao'
      },
      body: JSON.stringify({ status: 'Resolved' })
    });
    const dataB2 = await resB2.json();
    console.log('Status:', resB2.status);
    console.log('Reply:', JSON.stringify(dataB2));

    // B.3 Different officer id tries inspection action on assigned ticket -> 403
    await fetch(`${baseUrl}/tickets/${freshTicket2}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'authority',
        'x-actor-id': 'AUTH-HEAD-01',
        'x-actor-name': 'Commissioner Rao'
      },
      body: JSON.stringify({
        department: 'Roads',
        officerId: 'OFF-TEST-1',
        officerName: 'Suresh Kumar'
      })
    });

    console.log('\n--- B.3: Wrong Officer (OFF-TEST-WRONG) tries inspection action (Expect 403) ---');
    const resB3 = await fetch(`${baseUrl}/tickets/${freshTicket2}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-WRONG',
        'x-actor-name': 'Impostor Officer'
      },
      body: JSON.stringify({ action: 'start_inspection' })
    });
    const dataB3 = await resB3.json();
    console.log('Status:', resB3.status);
    console.log('Reply:', JSON.stringify(dataB3));

    // B.4 Inspection out of order: submit_remarks without starting inspection -> 409
    console.log('\n--- B.4: Inspection out of order: submit_remarks before starting inspection (Expect 409) ---');
    const resB4 = await fetch(`${baseUrl}/tickets/${freshTicket2}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-1',
        'x-actor-name': 'Suresh Kumar'
      },
      body: JSON.stringify({ action: 'submit_remarks', remarks: 'Trying to skip start step' })
    });
    const dataB4 = await resB4.json();
    console.log('Status:', resB4.status);
    console.log('Reply:', JSON.stringify(dataB4));

    // B.5 Missing actor headers -> 401
    console.log('\n--- B.5: Request with Missing Actor Headers (Expect 401) ---');
    const resB5 = await fetch(`${baseUrl}/tickets/${freshTicket2}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Under Review' })
    });
    const dataB5 = await resB5.json();
    console.log('Status:', resB5.status);
    console.log('Reply:', JSON.stringify(dataB5));


    // =========================================================================
    // SCENARIO C: Citizen Dispute Flow (Resolved -> Reopened - Under Investigation)
    // =========================================================================
    console.log('\n================================================================');
    console.log('SCENARIO C: Citizen Dispute Flow (Resolved -> Reopened)');
    console.log('================================================================');

    // Create Report C
    const repCRes = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '[TEST] Pothole near School Gate',
        category: 'Road Damage / Potholes',
        description: 'Dangerous pothole causing bicycle skids',
        wardNumber: 'Ward 8'
      })
    });
    const dataC = await repCRes.json();
    const ticketC = dataC.data?.ticketNumber;
    const reportCId = dataC.data?.reportId;
    console.log(`Created Report: ${reportCId}, Ticket: ${ticketC}`);

    // Assign to OFF-TEST-1
    await fetch(`${baseUrl}/tickets/${ticketC}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'authority',
        'x-actor-id': 'AUTH-HEAD-01',
        'x-actor-name': 'Commissioner Rao'
      },
      body: JSON.stringify({
        department: 'Roads Department',
        officerId: 'OFF-TEST-1',
        officerName: 'Suresh Kumar'
      })
    });

    // Run officer flow to reach Resolved
    await fetch(`${baseUrl}/tickets/${ticketC}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-1',
        'x-actor-name': 'Suresh Kumar'
      },
      body: JSON.stringify({ action: 'start_inspection' })
    });
    await fetch(`${baseUrl}/tickets/${ticketC}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-1',
        'x-actor-name': 'Suresh Kumar'
      },
      body: JSON.stringify({ action: 'mark_in_progress' })
    });
    await fetch(`${baseUrl}/tickets/${ticketC}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-1',
        'x-actor-name': 'Suresh Kumar'
      },
      body: JSON.stringify({ action: 'upload_after_photo', photoUrl: 'https://civicreflex.gov.in/photos/patched.jpg' })
    });
    const resCResolve = await fetch(`${baseUrl}/tickets/${ticketC}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'field_officer',
        'x-actor-id': 'OFF-TEST-1',
        'x-actor-name': 'Suresh Kumar'
      },
      body: JSON.stringify({ action: 'submit_completion', note: 'Filled with cold asphalt mix' })
    });
    const dataCResolve = await resCResolve.json();
    console.log('Ticket Status reached:', dataCResolve.data?.currentStatus);

    // Citizen disputes resolution
    console.log('\n--- Citizen Disputes Resolution ---');
    const resCDispute = await fetch(`${baseUrl}/tickets/${ticketC}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-role': 'citizen',
        'x-actor-id': 'CIT-RAHUL-02',
        'x-actor-name': 'Rahul Verma'
      },
      body: JSON.stringify({
        decision: 'dispute',
        comment: 'Cold asphalt gravel washed away in the morning shower, the deep hole is back.'
      })
    });
    const dataCDispute = await resCDispute.json();
    console.log('Dispute Status:', resCDispute.status);
    console.log('Ticket Status after Dispute:', dataCDispute.data?.currentStatus);

    // Check linked report status
    const repCCheck = await fetch(`${baseUrl}/reports/${reportCId}`);
    const repCData = await repCCheck.json();
    console.log('Report Status after Dispute:', repCData.data?.status);
    console.log('Report Status is Reopened - Under Investigation:', repCData.data?.status === 'Reopened - Under Investigation');


    // =========================================================================
    // CLEANUP: Delete all [TEST] data
    // =========================================================================
    console.log('\n================================================================');
    console.log('CLEANUP: Removing all [TEST] reports and tickets');
    console.log('================================================================');
    await mongoose.connect(mongoUri);

    const testReports = await Report.find({ title: { $regex: '^\\[TEST\\]' } });
    const ticketNums = testReports.map(r => r.ticketNumber).filter(Boolean);

    const delRep = await Report.deleteMany({ title: { $regex: '^\\[TEST\\]' } });
    console.log(`Deleted ${delRep.deletedCount} [TEST] report(s).`);

    const delTkt = await Ticket.deleteMany({
      $or: [
        { ticketNumber: { $in: ticketNums } },
        { subject: { $regex: '^\\[TEST\\]' } }
      ]
    });
    console.log(`Deleted ${delTkt.deletedCount} [TEST] ticket(s).`);

    await mongoose.disconnect();
    console.log('MongoDB disconnected cleanly.');

  } catch (err) {
    console.error('Error during test execution:', err);
    process.exit(1);
  }
}

runTestSuite();
