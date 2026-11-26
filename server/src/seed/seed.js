/**
 * src/seed/seed.js
 * 
 * Purpose:
 * Comprehensive seed script for CivicReflex portal database.
 * Seeds administrative wards, departments, grievance categories, municipal settings,
 * demo accounts, field officers, and ~300 realistic reports with linked tickets.
 * 
 * Features:
 * - Idempotent: Deletes only `isSeed: true` documents on each run.
 * - Production safety: Refuses execution when NODE_ENV === 'production'.
 * - Counter sync: Advances report and ticket sequence counters past seeded IDs.
 * - Demo clusters: Night-time illumination clusters and overdue SLA tickets.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const connectDB = require('../config/db');
const User = require('../modules/users/user.model');
const Report = require('../modules/reports/report.model');
const Ticket = require('../modules/tickets/ticket.model');
const Ward = require('../modules/wards/ward.model');
const Department = require('../modules/departments/department.model');
const Category = require('../modules/categories/category.model');
const Settings = require('../modules/settings/settings.model');
const AuditLog = require('../modules/audit/auditLog.model');
const { Counter } = require('../utils/counter');
const { hashPassword } = require('../utils/token');

// Seed data sources
const {
  DEMO_USERS,
  INITIAL_USERS,
  INITIAL_WARDS,
  INITIAL_DEPARTMENTS,
  INITIAL_CATEGORIES
} = require('./data/mockUsers');
const { MOCK_REPORTS } = require('./data/mockReports');
const { MOCK_TICKETS } = require('./data/mockTickets');
const { DEFAULT_SETTINGS } = require('./data/defaultSettings');

// Safety guard: Never run seed in production environment
if (process.env.NODE_ENV === 'production') {
  console.error('[Seed Error] Refusing to seed database when NODE_ENV is set to production.');
  process.exit(1);
}

// Center coordinates for municipal wards (around Pune 18.5204 N, 73.8567 E)
const WARD_CENTERS = {
  'Ward 14': { lat: 18.5050, lng: 73.8550, zone: 'South Zone' },
  'Ward 08': { lat: 18.5204, lng: 73.8567, zone: 'Central Zone' },
  'Ward 22': { lat: 18.5450, lng: 73.8600, zone: 'North Zone' },
  'Ward 11': { lat: 18.5250, lng: 73.8300, zone: 'West Zone' },
  'Ward 03': { lat: 18.5280, lng: 73.8650, zone: 'Central Zone' },
  'Ward 05': { lat: 18.5150, lng: 73.8850, zone: 'East Zone' }
};

const DEFAULT_CENTER = { lat: 18.5204, lng: 73.8567, zone: 'Central Zone' };

// Date parsing helper
const parseDate = (val, fallback = new Date()) => {
  if (!val) return fallback;
  if (val instanceof Date) return val;
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d;
  const cleaned = val.replace(/^(Estimated:\s*|Pending:\s*|Scheduled:\s*)/i, '').trim();
  const d2 = new Date(cleaned);
  if (!isNaN(d2.getTime())) return d2;
  return fallback;
};

// Urgency level normalization
const normalizeUrgency = (level) => {
  if (!level) return 'Medium';
  const l = level.toLowerCase();
  if (l.includes('crit')) return 'Critical';
  if (l.includes('high')) return 'High';
  if (l.includes('low')) return 'Low';
  return 'Medium';
};

// Realistic pseudo-random generator with fixed seed for 100% deterministic results
let seedVal = 42;
const pseudoRandom = () => {
  seedVal = (seedVal * 9301 + 49297) % 233280;
  return seedVal / 233280;
};

const seedDatabase = async () => {
  console.log('[Seed] Starting database seeding process...');
  seedVal = 42; // Reset deterministic PRNG

  await connectDB();

  // 1. Clean existing seeded documents
  console.log('[Seed] Cleaning previous seeded documents (isSeed: true)...');
  await Promise.all([
    User.deleteMany({ isSeed: true }),
    Report.deleteMany({ isSeed: true }),
    Ticket.deleteMany({ isSeed: true }),
    Ward.deleteMany({ isSeed: true }),
    Department.deleteMany({ isSeed: true }),
    Category.deleteMany({ isSeed: true }),
    Settings.deleteMany({ isSeed: true }),
    AuditLog.deleteMany({ isSeed: true })
  ]);

  // 2. Seed Settings
  console.log('[Seed] Seeding municipal portal settings...');
  await Settings.create({
    ...DEFAULT_SETTINGS,
    isSeed: true
  });

  // 3. Seed Wards
  console.log('[Seed] Seeding administrative wards...');
  const wardDocs = INITIAL_WARDS.map((w) => ({
    wardNumber: w.wardNumber,
    wardName: w.wardName,
    zone: w.zone,
    assignedAuthority: w.assignedAuthority,
    fieldOfficers: w.fieldOfficers || [],
    status: w.status || 'Active',
    isSeed: true
  }));
  await Ward.insertMany(wardDocs);

  // 4. Seed Departments
  console.log('[Seed] Seeding municipal departments...');
  const deptDocs = INITIAL_DEPARTMENTS.map((d) => ({
    name: d.name,
    code: d.code,
    nodalOfficer: d.nodalOfficer,
    officerCount: d.officerCount || 0,
    budgetAllocated: d.budgetAllocated,
    contactEmail: d.contactEmail,
    isSeed: true
  }));
  await Department.insertMany(deptDocs);

  // 5. Seed Categories
  console.log('[Seed] Seeding grievance categories...');
  const catDocs = INITIAL_CATEGORIES.map((c) => ({
    name: c.name,
    department: c.department,
    defaultPriority: c.defaultPriority || 'Medium',
    defaultSlaHours: c.defaultSlaHours || 48,
    status: c.status || 'Active',
    description: c.description,
    isSeed: true
  }));
  // Also add Poorly Lit Streets experience category
  catDocs.push({
    name: 'Poorly Lit Streets',
    department: 'Electrical Maintenance',
    defaultPriority: 'High',
    defaultSlaHours: 48,
    status: 'Active',
    description: 'Pedestrian dark corridors and non-functional illumination stretches.',
    isSeed: true
  });
  await Category.insertMany(catDocs);

  // 6. Seed Users
  console.log('[Seed] Seeding demo users and additional citizen reporters...');
  const usersToInsert = [];
  const insertedEmails = new Set();

  // (a) Demo accounts with explicit passwords
  const demoAccounts = [
    { ...DEMO_USERS.CITIZEN, password: DEMO_USERS.CITIZEN.password || 'citizen123' },
    { ...DEMO_USERS.AUTHORITY, password: DEMO_USERS.AUTHORITY.password || 'authority123' },
    { ...DEMO_USERS.FIELD_OFFICER, password: DEMO_USERS.FIELD_OFFICER.password || 'officer123' },
    { ...DEMO_USERS.ADMIN, password: DEMO_USERS.ADMIN.password || 'admin123' }
  ];

  for (const demo of demoAccounts) {
    const passwordHash = await hashPassword(demo.password);
    usersToInsert.push({
      userCode: demo.id,
      name: demo.name,
      email: demo.email.toLowerCase(),
      passwordHash,
      role: demo.role,
      designation: demo.designation,
      department: demo.department,
      ward: demo.ward,
      phone: demo.phone,
      badgeNumber: demo.badgeNumber,
      accountStatus: demo.accountStatus || 'Active',
      memberSince: demo.memberSince ? parseDate(demo.memberSince) : new Date('2024-01-15'),
      isSeed: true
    });
    insertedEmails.add(demo.email.toLowerCase());
  }

  // (b) Initial users from mockUsers
  for (const u of INITIAL_USERS) {
    const emailNorm = u.email.toLowerCase();
    if (insertedEmails.has(emailNorm)) continue;
    insertedEmails.add(emailNorm);

    const defaultPass = u.role === 'admin' ? 'admin123' : `${u.role}123`;
    const passwordHash = await hashPassword(defaultPass);
    usersToInsert.push({
      userCode: u.id,
      name: u.name,
      email: emailNorm,
      passwordHash,
      role: u.role,
      designation: u.designation,
      department: u.department,
      ward: u.ward,
      phone: u.phone,
      badgeNumber: u.badgeNumber,
      accountStatus: u.accountStatus || 'Active',
      memberSince: u.registrationDate ? parseDate(u.registrationDate) : new Date('2024-02-01'),
      isSeed: true
    });
  }

  // (c) 10 Extra Seed Citizens as reporters
  const extraCitizenNames = [
    'Rahul Sharma', 'Priya Joshi', 'Rohan Patil', 'Sunita Deshmukh',
    'Amit Kulkarni', 'Sneha Shinde', 'Arvind Mehta', 'Pooja Verma',
    'Suresh Gupta', 'Ananya Roy'
  ];

  const seedCitizenCodes = [];
  for (let i = 0; i < extraCitizenNames.length; i++) {
    const idx = i + 1;
    const userCode = `USR-SEED-${String(idx).padStart(2, '0')}`;
    seedCitizenCodes.push(userCode);
    const email = `citizen${idx}@civicreflex.demo`;
    if (!insertedEmails.has(email)) {
      insertedEmails.add(email);
      const passwordHash = await hashPassword('citizen123');
      usersToInsert.push({
        userCode,
        name: extraCitizenNames[i],
        email,
        passwordHash,
        role: 'citizen',
        designation: 'Registered Citizen Resident',
        ward: `Ward ${['14', '08', '22', '11', '03', '05'][i % 6]}`,
        phone: `+91 98200 ${String(10000 + i * 111).slice(1)}`,
        accountStatus: 'Active',
        memberSince: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        isSeed: true
      });
    }
  }

  await User.insertMany(usersToInsert);

  // 7. Seed MOCK_REPORTS and MOCK_TICKETS
  console.log('[Seed] Seeding initial mock reports and tickets...');
  const reportsToInsert = [];
  const ticketsToInsert = [];

  for (const r of MOCK_REPORTS) {
    const wardKey = r.wardNumber || 'Ward 14';
    const center = WARD_CENTERS[wardKey] || DEFAULT_CENTER;
    const repDate = parseDate(r.reportedAt, new Date('2026-10-28T09:15:00.000Z'));

    // Coordinates: longitude first, latitude second
    const lng = center.lng + (pseudoRandom() - 0.5) * 0.008;
    const lat = center.lat + (pseudoRandom() - 0.5) * 0.008;

    const actions = (r.actionsTaken || []).map((a) => ({
      timestamp: parseDate(a.timestamp, repDate),
      action: a.action
    }));

    reportsToInsert.push({
      reportId: r.id,
      ticketNumber: r.ticketNumber,
      type: r.type || 'issue',
      title: r.title,
      category: r.category,
      subcategory: r.subcategory,
      description: r.description || r.title,
      location: r.location,
      zone: r.zone || center.zone,
      wardNumber: wardKey,
      landmark: r.landmark,
      geo: {
        type: 'Point',
        coordinates: [Number(lng.toFixed(5)), Number(lat.toFixed(5))]
      },
      photoUrl: r.photoUrl,
      status: r.status || 'Reported',
      severity: normalizeUrgency(r.severity),
      upvotes: r.upvotes || 0,
      verifiedCount: r.verifiedCount || 0,
      verifiedBy: [],
      isAnonymous: !!r.isAnonymous,
      timeOfDay: r.timeOfDay || 'Morning',
      reportedAt: repDate,
      actionsTaken: actions,
      assignedDepartment: r.assignedDepartment,
      assignedOfficer: r.assignedOfficer,
      slaTargetDate: r.slaTargetDate ? parseDate(r.slaTargetDate) : null,
      createdBy: r.reporterName ? 'USR-88219' : 'USR-88219',
      isFlagged: r.moderationStatus === 'Pending Moderation',
      flagReason: r.flagReason,
      moderationStatus: r.moderationStatus && r.moderationStatus !== 'Pending Moderation' ? r.moderationStatus : (r.moderationStatus === 'Pending Moderation' ? 'Pending' : 'None'),
      isSeed: true
    });

    // Create or link corresponding ticket
    const t = MOCK_TICKETS[r.ticketNumber];
    if (t) {
      const subDate = parseDate(t.submissionDate, repDate);
      const expDate = parseDate(t.expectedResolutionDate, new Date(subDate.getTime() + 48 * 60 * 60 * 1000));

      const timeline = (t.timeline || []).map((s) => ({
        stage: s.stage,
        title: s.title,
        description: s.description,
        date: parseDate(s.date, subDate),
        completed: !!s.completed,
        officer: s.officer || null
      }));

      ticketsToInsert.push({
        ticketNumber: t.ticketNumber,
        reportIds: [r.id],
        source: 'manual',
        currentStatus: t.currentStatus || r.status || 'Reported',
        urgencyLevel: normalizeUrgency(t.urgencyLevel || r.severity),
        ward: wardKey,
        category: t.category || r.category,
        issueType: t.issueType || r.subcategory,
        subject: t.subject || r.title,
        address: t.address || r.location,
        submissionDate: subDate,
        expectedResolutionDate: expDate,
        assignedOfficerId: t.assignedOfficerId || null,
        assignedAuthority: t.assignedAuthority || {},
        priorityScore: 50,
        createdBy: 'USR-88219',
        timeline,
        isSeed: true
      });
    } else if (r.ticketNumber) {
      ticketsToInsert.push({
        ticketNumber: r.ticketNumber,
        reportIds: [r.id],
        source: 'manual',
        currentStatus: r.status || 'Reported',
        urgencyLevel: normalizeUrgency(r.severity),
        ward: wardKey,
        category: r.category,
        issueType: r.subcategory || 'General Grievance',
        subject: r.title,
        address: r.location,
        submissionDate: repDate,
        expectedResolutionDate: new Date(repDate.getTime() + 48 * 60 * 60 * 1000),
        assignedOfficerId: null,
        assignedAuthority: {},
        priorityScore: 50,
        createdBy: 'USR-88219',
        timeline: [
          {
            stage: 'Registered',
            title: 'Grievance Lodged',
            description: 'Complaint registered by citizen.',
            date: repDate,
            completed: true,
            officer: 'System Automated Desk'
          }
        ],
        isSeed: true
      });
    }
  }

  // 8. Generate ~300 Realistic Reports & Linked Tickets
  console.log('[Seed] Generating ~300 additional realistic reports and grievance tickets...');

  // Target status counts to match realistic municipal distribution
  const statusDistribution = [
    { status: 'Reported', count: 75 },
    { status: 'Assigned', count: 70 },
    { status: 'In Progress', count: 65 },
    { status: 'Verified', count: 30 },
    { status: 'Under Review', count: 15 },
    { status: 'Resolved', count: 25 },
    { status: 'Citizen-Confirmed', count: 10 },
    { status: 'Escalated', count: 5 },
    { status: 'Reopened - Under Investigation', count: 2 },
    { status: 'Rejected by Moderation', count: 1 },
    { status: 'Duplicate', count: 1 },
    { status: 'Clarification Requested', count: 1 }
  ]; // Total: 300 reports

  const categories = [
    'Road Damage / Potholes',
    'Garbage and Waste Management',
    'Streetlight Issues',
    'Drainage and Waterlogging',
    'Footpath and Accessibility',
    'Public Safety'
  ];

  const subcategoriesMap = {
    'Road Damage / Potholes': ['Pothole Repair', 'Asphalt Patching', 'Road Shoulder Erosion'],
    'Garbage and Waste Management': ['Overflowing Bin', 'Debris Clearance', 'Illegal Dumping'],
    'Streetlight Issues': ['Streetlight Outage', 'Flickering Lamp', 'Damaged Electric Pole'],
    'Drainage and Waterlogging': ['Choked Storm Drain', 'Monsoon Waterlogging', 'Broken Drain Cover'],
    'Footpath and Accessibility': ['Broken Paver Blocks', 'Missing Curb Ramp', 'Footpath Obstruction'],
    'Public Safety': ['Blind Corner', 'Open Inspection Pit', 'Deserted Alley Dark Stretch']
  };

  const wardKeys = Object.keys(WARD_CENTERS);
  const severities = ['Low', 'Medium', 'High', 'Critical'];
  const timesOfDay = ['Morning', 'Afternoon', 'Evening', 'Night'];

  // Track reports by status to fulfill
  const statusQueue = [];
  for (const item of statusDistribution) {
    for (let c = 0; c < item.count; c++) {
      statusQueue.push(item.status);
    }
  }

  // Next sequence baseline numbers
  let nextReportSeq = 1060;
  let nextTicketSeq = 9001;

  // Track demo overdue tickets count
  let overdueTicketsCount = 0;

  for (let i = 0; i < statusQueue.length; i++) {
    const status = statusQueue[i];
    const reportId = `REP-2026-${nextReportSeq++}`;
    const ticketNumber = `CR-2026-${nextTicketSeq++}`;

    // Select ward and category
    const wardKey = wardKeys[i % wardKeys.length];
    const center = WARD_CENTERS[wardKey];
    const category = categories[i % categories.length];
    const subcats = subcategoriesMap[category] || ['General Grievance'];
    const subcategory = subcats[i % subcats.length];

    // Reporter: cycle through 10 seed citizens
    const reporterUserCode = seedCitizenCodes[i % seedCitizenCodes.length];
    const isAnon = i % 5 === 0;

    // Severity & Time of day
    const severity = severities[i % severities.length];
    const timeOfDay = timesOfDay[i % timesOfDay.length];

    // Reported date: between 1 and 80 days ago
    const daysAgo = 1 + (i % 79);
    const reportedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    // Coordinate jitter within ~600m
    const lng = center.lng + (pseudoRandom() - 0.5) * 0.010;
    const lat = center.lat + (pseudoRandom() - 0.5) * 0.010;

    // Overdue SLA demo: exactly 12 tickets across wards in Assigned or In Progress
    let expectedResolutionDate = new Date(reportedAt.getTime() + 48 * 60 * 60 * 1000);
    if (overdueTicketsCount < 12 && (status === 'Assigned' || status === 'In Progress')) {
      // Set submission 35 days ago and expected resolution 20 days ago (past)
      expectedResolutionDate = new Date(Date.now() - (15 + (overdueTicketsCount % 5)) * 24 * 60 * 60 * 1000);
      overdueTicketsCount++;
    }

    // Dynamic actionsTaken & ticket timeline matching status
    const actionsTaken = [
      {
        timestamp: reportedAt,
        action: `Grievance registered by citizen via CivicReflex Mobile Web Portal`
      }
    ];

    const timeline = [
      {
        stage: 'Registered',
        title: 'Grievance Lodged',
        description: `Logged with verified coordinates for ${wardKey}.`,
        date: reportedAt,
        completed: true,
        officer: 'System Automated Routing'
      }
    ];

    if (['Verified', 'Assigned', 'In Progress', 'Resolved', 'Citizen-Confirmed'].includes(status)) {
      const vDate = new Date(reportedAt.getTime() + 2 * 60 * 60 * 1000);
      actionsTaken.push({ timestamp: vDate, action: 'Community verification threshold reached' });
      timeline.push({
        stage: 'Verified',
        title: 'Citizen Verification Reached',
        description: 'Verified by local residents.',
        date: vDate,
        completed: true,
        officer: 'Ward Citizens Council'
      });
    }

    if (['Assigned', 'In Progress', 'Resolved', 'Citizen-Confirmed'].includes(status)) {
      const aDate = new Date(reportedAt.getTime() + 5 * 60 * 60 * 1000);
      actionsTaken.push({ timestamp: aDate, action: `Assigned to ${wardKey} Maintenance Squad` });
      timeline.push({
        stage: 'Assigned',
        title: 'Assigned to Ward Engineer',
        description: 'Work order drafted and allocated.',
        date: aDate,
        completed: true,
        officer: 'Er. Rameshwar Rao'
      });
    }

    if (['In Progress', 'Resolved', 'Citizen-Confirmed'].includes(status)) {
      const pDate = new Date(reportedAt.getTime() + 18 * 60 * 60 * 1000);
      actionsTaken.push({ timestamp: pDate, action: 'Field site inspection and execution initiated' });
      timeline.push({
        stage: 'Field Inspection',
        title: 'Physical Inspection Completed',
        description: 'Junior engineer verified dimensions on site.',
        date: pDate,
        completed: true,
        officer: 'Mr. V. Nair (JE)'
      });
      timeline.push({
        stage: 'Execution',
        title: 'Repair Works in Progress',
        description: 'Materials delivered and repair squad deployed.',
        date: pDate,
        completed: true,
        officer: 'Squad Leader'
      });
    }

    if (['Resolved', 'Citizen-Confirmed'].includes(status)) {
      const rDate = new Date(reportedAt.getTime() + 36 * 60 * 60 * 1000);
      actionsTaken.push({ timestamp: rDate, action: 'Remediation completed on site with after-repair photographs' });
      timeline.push({
        stage: 'Closure',
        title: 'Resolution Completed',
        description: 'Official repairs signed off by supervising engineer.',
        date: rDate,
        completed: true,
        officer: 'Junior Engineer'
      });
    }

    if (status === 'Citizen-Confirmed') {
      const cDate = new Date(reportedAt.getTime() + 42 * 60 * 60 * 1000);
      actionsTaken.push({ timestamp: cDate, action: 'Resolution confirmed by citizen reporter' });
    }

    if (status === 'Escalated') {
      const eDate = new Date(reportedAt.getTime() + 48 * 60 * 60 * 1000);
      actionsTaken.push({ timestamp: eDate, action: 'SLA breach: Automatically escalated to Zonal Commissioner' });
    }

    // Engagement stats
    const upvotes = Math.floor(pseudoRandom() * 45);
    const verifiedCount = Math.floor(pseudoRandom() * 12);
    const verifiedBy = verifiedCount > 0 ? [reporterUserCode] : [];

    reportsToInsert.push({
      reportId,
      ticketNumber,
      type: 'issue',
      title: `${category} near ${subcategory} on Main Road, ${wardKey}`,
      category,
      subcategory,
      description: `Reported civic defect: ${subcategory}. Citizen observed safety obstruction and requested swift municipal resolution.`,
      location: `Near Landmark # ${100 + (i % 50)}, ${wardKey}`,
      zone: center.zone,
      wardNumber: wardKey,
      landmark: `Opposite Civic Square ${1 + (i % 10)}`,
      geo: {
        type: 'Point',
        coordinates: [Number(lng.toFixed(5)), Number(lat.toFixed(5))]
      },
      photoUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80',
      status,
      severity,
      upvotes,
      verifiedCount,
      verifiedBy,
      isAnonymous: isAnon,
      timeOfDay,
      reportedAt,
      actionsTaken,
      assignedDepartment: 'Roads and Infrastructure',
      assignedOfficer: 'Mr. V. Nair (JE)',
      slaTargetDate: expectedResolutionDate,
      createdBy: reporterUserCode,
      isSeed: true
    });

    ticketsToInsert.push({
      ticketNumber,
      reportIds: [reportId],
      source: status === 'Escalated' ? 'auto-escalated' : 'manual',
      currentStatus: status,
      urgencyLevel: severity,
      ward: wardKey,
      category,
      issueType: subcategory,
      subject: `${category} near ${subcategory} on Main Road, ${wardKey}`,
      address: `Near Landmark # ${100 + (i % 50)}, ${wardKey}`,
      submissionDate: reportedAt,
      expectedResolutionDate,
      assignedOfficerId: ['Assigned', 'In Progress', 'Resolved', 'Citizen-Confirmed'].includes(status) ? 'OFF-PWD-014' : null,
      assignedAuthority: {
        name: 'Mr. V. Nair',
        designation: 'Junior Engineer',
        department: 'Roads and Infrastructure',
        contact: 'officer.pwd@civicreflex.gov.in'
      },
      priorityScore: severity === 'Critical' ? 90 : severity === 'High' ? 70 : 40,
      createdBy: reporterUserCode,
      timeline,
      isSeed: true
    });
  }

  // 9. Add Demo Clusters for Night-time Illumination Safety
  // Cluster A: 6 "experience" reports ("Poorly Lit Streets", "Night") within ~150m of one point
  console.log('[Seed] Generating Demo Cluster 1 (6 reports within 150m in Ward 08)...');
  const cluster1Center = { lat: 18.5204, lng: 73.8567 }; // Ward 08 center
  for (let c = 0; c < 6; c++) {
    const reportId = `REP-2026-${nextReportSeq++}`;
    const ticketNumber = `CR-2026-${nextTicketSeq++}`;
    const reporterUserCode = seedCitizenCodes[c]; // 6 distinct citizens

    // Within ~150 meters (0.0006 deg ≈ 65m)
    const angle = (c * 2 * Math.PI) / 6;
    const distanceDeg = 0.0005; // ~55 meters
    const lng = cluster1Center.lng + Math.cos(angle) * distanceDeg;
    const lat = cluster1Center.lat + Math.sin(angle) * distanceDeg;

    const reportedAt = new Date(Date.now() - (3 + c) * 24 * 60 * 60 * 1000);

    reportsToInsert.push({
      reportId,
      ticketNumber,
      type: 'experience',
      title: `Dark corridor: Faulty illumination near Gandhi Market Alley ${c + 1}`,
      category: 'Poorly Lit Streets',
      subcategory: 'Dark Corridor',
      description: `Complete absence of working street illumination along pedestrian stretch. Safety concern during night transit.`,
      location: `Gandhi Market Secondary Byway # ${c + 1}, Ward 08`,
      zone: 'Central Zone',
      wardNumber: 'Ward 08',
      landmark: `Behind Central Library Pillar #${c + 10}`,
      geo: {
        type: 'Point',
        coordinates: [Number(lng.toFixed(5)), Number(lat.toFixed(5))]
      },
      photoUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=600&q=80',
      status: 'Reported',
      severity: 'High',
      upvotes: 14 + c * 2,
      verifiedCount: 5 + c,
      verifiedBy: [reporterUserCode],
      isAnonymous: false,
      timeOfDay: 'Night',
      reportedAt,
      actionsTaken: [
        { timestamp: reportedAt, action: 'Night safety experience reported by citizen' }
      ],
      assignedDepartment: 'Electrical Maintenance',
      createdBy: reporterUserCode,
      isSeed: true
    });

    ticketsToInsert.push({
      ticketNumber,
      reportIds: [reportId],
      source: 'manual',
      currentStatus: 'Reported',
      urgencyLevel: 'High',
      ward: 'Ward 08',
      category: 'Poorly Lit Streets',
      issueType: 'Dark Corridor',
      subject: `Dark corridor: Faulty illumination near Gandhi Market Alley ${c + 1}`,
      address: `Gandhi Market Secondary Byway # ${c + 1}, Ward 08`,
      submissionDate: reportedAt,
      expectedResolutionDate: new Date(reportedAt.getTime() + 48 * 60 * 60 * 1000),
      assignedOfficerId: null,
      priorityScore: 75,
      createdBy: reporterUserCode,
      timeline: [
        {
          stage: 'Registered',
          title: 'Night Blind Spot Logged',
          description: 'Illumination issue reported under Night Safety cluster protocol.',
          date: reportedAt,
          completed: true,
          officer: 'Blind Spot Audit System'
        }
      ],
      isSeed: true
    });
  }

  // Cluster B: 3 "experience" reports ("Poorly Lit Streets", "Night") within ~150m of another point
  console.log('[Seed] Generating Demo Cluster 2 (3 reports within 150m in Ward 14)...');
  const cluster2Center = { lat: 18.5050, lng: 73.8550 }; // Ward 14 center
  for (let c = 0; c < 3; c++) {
    const reportId = `REP-2026-${nextReportSeq++}`;
    const ticketNumber = `CR-2026-${nextTicketSeq++}`;
    const reporterUserCode = seedCitizenCodes[6 + c]; // 3 distinct citizens

    const angle = (c * 2 * Math.PI) / 3;
    const distanceDeg = 0.00045; // ~50 meters
    const lng = cluster2Center.lng + Math.cos(angle) * distanceDeg;
    const lat = cluster2Center.lat + Math.sin(angle) * distanceDeg;

    const reportedAt = new Date(Date.now() - (2 + c) * 24 * 60 * 60 * 1000);

    reportsToInsert.push({
      reportId,
      ticketNumber,
      type: 'experience',
      title: `Unlit pedestrian underpass near M.G. Road Lane ${c + 1}`,
      category: 'Poorly Lit Streets',
      subcategory: 'Pedestrian Underpass',
      description: `Dark pedestrian crossing with non-functional sodium lamps. Multiple citizens flagged for immediate lighting repair.`,
      location: `M.G. Road South Passage ${c + 1}, Ward 14`,
      zone: 'South Zone',
      wardNumber: 'Ward 14',
      landmark: `Near Metro Sub-station Gate ${c + 1}`,
      geo: {
        type: 'Point',
        coordinates: [Number(lng.toFixed(5)), Number(lat.toFixed(5))]
      },
      photoUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=600&q=80',
      status: 'Reported',
      severity: 'Medium',
      upvotes: 8 + c * 3,
      verifiedCount: 3 + c,
      verifiedBy: [reporterUserCode],
      isAnonymous: false,
      timeOfDay: 'Night',
      reportedAt,
      actionsTaken: [
        { timestamp: reportedAt, action: 'Pedestrian night safety issue logged' }
      ],
      assignedDepartment: 'Electrical Maintenance',
      createdBy: reporterUserCode,
      isSeed: true
    });

    ticketsToInsert.push({
      ticketNumber,
      reportIds: [reportId],
      source: 'manual',
      currentStatus: 'Reported',
      urgencyLevel: 'Medium',
      ward: 'Ward 14',
      category: 'Poorly Lit Streets',
      issueType: 'Pedestrian Underpass',
      subject: `Unlit pedestrian underpass near M.G. Road Lane ${c + 1}`,
      address: `M.G. Road South Passage ${c + 1}, Ward 14`,
      submissionDate: reportedAt,
      expectedResolutionDate: new Date(reportedAt.getTime() + 48 * 60 * 60 * 1000),
      assignedOfficerId: null,
      priorityScore: 60,
      createdBy: reporterUserCode,
      timeline: [
        {
          stage: 'Registered',
          title: 'Night Underpass Safety Logged',
          description: 'Queued for Electrical Wing inspection.',
          date: reportedAt,
          completed: true,
          officer: 'Blind Spot Audit System'
        }
      ],
      isSeed: true
    });
  }

  // Insert all generated reports and tickets
  console.log(`[Seed] Inserting ${reportsToInsert.length} reports and ${ticketsToInsert.length} tickets...`);
  await Report.insertMany(reportsToInsert);
  await Ticket.insertMany(ticketsToInsert);

  // 10. Synchronize Sequence Counters
  console.log('[Seed] Synchronizing atomic sequence counters...');
  const maxReportNumber = nextReportSeq - 1; // e.g. 1368
  const maxTicketNumber = nextTicketSeq - 1; // e.g. 9309

  await Counter.findOneAndUpdate(
    { name: 'reports' },
    { $set: { seq: maxReportNumber } },
    { upsert: true, new: true }
  );

  await Counter.findOneAndUpdate(
    { name: 'tickets' },
    { $set: { seq: maxTicketNumber } },
    { upsert: true, new: true }
  );

  await Counter.findOneAndUpdate(
    { name: 'users' },
    { $max: { seq: 9000 } },
    { upsert: true, new: true }
  );

  // 11. Calculate and Print Aggregation Summary
  console.log('\n================== SEED SUMMARY ==================');
  const [
    userCount,
    reportCount,
    ticketCount,
    wardCount,
    deptCount,
    catCount,
    settingsCount
  ] = await Promise.all([
    User.countDocuments({ isSeed: true }),
    Report.countDocuments({ isSeed: true }),
    Ticket.countDocuments({ isSeed: true }),
    Ward.countDocuments({ isSeed: true }),
    Department.countDocuments({ isSeed: true }),
    Category.countDocuments({ isSeed: true }),
    Settings.countDocuments({ isSeed: true })
  ]);

  console.log('Collections (isSeed: true):');
  console.log(`  Users:        ${userCount}`);
  console.log(`  Reports:      ${reportCount}`);
  console.log(`  Tickets:      ${ticketCount}`);
  console.log(`  Wards:        ${wardCount}`);
  console.log(`  Departments:  ${deptCount}`);
  console.log(`  Categories:   ${catCount}`);
  console.log(`  Settings:     ${settingsCount}`);

  // Summary by Status
  const statusCounts = await Report.aggregate([
    { $match: { isSeed: true } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  console.log('\nReports by Status:');
  for (const s of statusCounts) {
    console.log(`  ${s._id.padEnd(30)}: ${s.count}`);
  }

  // Summary by Ward
  const wardReportCounts = await Report.aggregate([
    { $match: { isSeed: true } },
    { $group: { _id: '$wardNumber', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  console.log('\nReports by Ward:');
  for (const w of wardReportCounts) {
    console.log(`  ${(w._id || 'Unknown').padEnd(20)}: ${w.count}`);
  }

  console.log('\nCounters Synchronized:');
  console.log(`  reports counter set to: ${maxReportNumber}`);
  console.log(`  tickets counter set to: ${maxTicketNumber}`);
  console.log('==================================================\n');

  await mongoose.disconnect();
  console.log('[Seed] Seeding completed successfully.');
};

if (require.main === module) {
  seedDatabase().catch((err) => {
    console.error('[Seed Error] Seeding failed:', err);
    if (mongoose.connection.readyState !== 0) {
      mongoose.disconnect();
    }
    process.exit(1);
  });
}

module.exports = seedDatabase;
