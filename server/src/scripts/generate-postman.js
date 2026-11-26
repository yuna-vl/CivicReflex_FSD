/**
 * src/scripts/generate-postman.js
 * 
 * Generates the complete Postman Collection v2.1 for CivicReflex API.
 */

const fs = require('fs');
const path = require('path');

const collection = {
  info: {
    _postman_id: 'c1790aa6-8842-4901-8860-civicreflex01',
    name: 'CivicReflex API Collection',
    description: 'Complete API reference for CivicReflex civic governance and citizen grievance platform.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:5000', type: 'string' },
    { key: 'accessToken', value: '', type: 'string' }
  ],
  item: [
    {
      name: '1. Authentication',
      item: [
        {
          name: 'Register Citizen',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                name: 'Ananya Roy',
                email: 'ananya.roy@civicreflex.demo',
                password: 'citizen123',
                phone: '+91 98200 44821',
                ward: 'Ward 14'
              }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/auth/register', host: ['{{baseUrl}}'], path: ['api', 'auth', 'register'] }
          }
        },
        {
          name: 'Login (Saves Access Token)',
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'const res = pm.response.json();',
                  'if (res.success && res.data && res.data.accessToken) {',
                  '  pm.collectionVariables.set("accessToken", res.data.accessToken);',
                  '  console.log("accessToken successfully saved:", res.data.accessToken);',
                  '}'
                ]
              }
            }
          ],
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                email: 'admin@civicreflex.gov.in',
                password: 'admin123'
              }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/auth/login', host: ['{{baseUrl}}'], path: ['api', 'auth', 'login'] }
          }
        },
        {
          name: 'Refresh Token',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: {
              mode: 'raw',
              raw: JSON.stringify({ refreshToken: '<your_refresh_token_here>' }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/auth/refresh', host: ['{{baseUrl}}'], path: ['api', 'auth', 'refresh'] }
          }
        },
        {
          name: 'Get Current User Profile',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }],
            url: { raw: '{{baseUrl}}/api/auth/me', host: ['{{baseUrl}}'], path: ['api', 'auth', 'me'] }
          }
        },
        {
          name: 'Change Password',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{accessToken}}' },
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                currentPassword: 'admin123',
                newPassword: 'NewSecureAdminPassword123!'
              }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/auth/change-password', host: ['{{baseUrl}}'], path: ['api', 'auth', 'change-password'] }
          }
        },
        {
          name: 'Logout',
          request: {
            method: 'POST',
            header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }],
            url: { raw: '{{baseUrl}}/api/auth/logout', host: ['{{baseUrl}}'], path: ['api', 'auth', 'logout'] }
          }
        }
      ]
    },
    {
      name: '2. Reports API',
      item: [
        {
          name: 'Create Report',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{accessToken}}' },
              { key: 'Content-Type', value: 'application/json' },
              { key: 'Idempotency-Key', value: 'crm-unique-client-key-001' }
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                title: 'Hazardous deep pothole near traffic junction',
                category: 'Road Damage / Potholes',
                subcategory: 'Pothole Repair',
                location: 'M.G. Road Junction, Ward 14',
                wardNumber: 'Ward 14',
                zone: 'South Zone',
                landmark: 'Opposite State Bank ATM',
                severity: 'High',
                timeOfDay: 'Evening',
                latitude: 18.5050,
                longitude: 73.8550,
                description: 'Deep road cavity causing severe risk for two-wheelers during peak traffic.'
              }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/reports', host: ['{{baseUrl}}'], path: ['api', 'reports'] }
          }
        },
        {
          name: 'List Reports (Cursor & Filter)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/reports?wardNumber=Ward 14&limit=20',
              host: ['{{baseUrl}}'],
              path: ['api', 'reports'],
              query: [
                { key: 'wardNumber', value: 'Ward 14' },
                { key: 'status', value: 'Reported', disabled: true },
                { key: 'limit', value: '20' },
                { key: 'cursor', value: '', disabled: true }
              ]
            }
          }
        },
        {
          name: 'Get Report by ID',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }],
            url: { raw: '{{baseUrl}}/api/reports/REP-2026-1049', host: ['{{baseUrl}}'], path: ['api', 'reports', 'REP-2026-1049'] }
          }
        },
        {
          name: 'Verify Report',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{accessToken}}' },
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: { mode: 'raw', raw: '{}' },
            url: { raw: '{{baseUrl}}/api/reports/REP-2026-1049/verify', host: ['{{baseUrl}}'], path: ['api', 'reports', 'REP-2026-1049', 'verify'] }
          }
        },
        {
          name: 'Flag Report for Moderation',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{accessToken}}' },
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({ reason: 'Commercial coaching class flex advertisement photo' }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/reports/REP-2026-1057/flag', host: ['{{baseUrl}}'], path: ['api', 'reports', 'REP-2026-1057', 'flag'] }
          }
        }
      ]
    },
    {
      name: '3. Tickets API',
      item: [
        {
          name: 'List Tickets (Authority / Field Officer)',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }],
            url: {
              raw: '{{baseUrl}}/api/tickets?currentStatus=Assigned&limit=20',
              host: ['{{baseUrl}}'],
              path: ['api', 'tickets'],
              query: [
                { key: 'currentStatus', value: 'Assigned' },
                { key: 'ward', value: 'Ward 14', disabled: true },
                { key: 'limit', value: '20' },
                { key: 'cursor', value: '', disabled: true }
              ]
            }
          }
        },
        {
          name: 'Get Ticket by Number (Public Tracking)',
          request: {
            method: 'GET',
            url: { raw: '{{baseUrl}}/api/tickets/CR-2026-8842', host: ['{{baseUrl}}'], path: ['api', 'tickets', 'CR-2026-8842'] }
          }
        },
        {
          name: 'Assign Ticket to Officer (Authority Only)',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{accessToken}}' },
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                department: 'Roads and Infrastructure',
                officerId: 'OFF-PWD-014',
                officerName: 'Mr. V. Nair',
                designation: 'Junior Engineer (Roads)',
                contact: 'officer.pwd@civicreflex.gov.in',
                priority: 'High',
                directives: 'Execute site compaction and cold-mix patching within 24 hours.'
              }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/tickets/CR-2026-8850/assign', host: ['{{baseUrl}}'], path: ['api', 'tickets', 'CR-2026-8850', 'assign'] }
          }
        },
        {
          name: 'Update Ticket Status',
          request: {
            method: 'PATCH',
            header: [
              { key: 'Authorization', value: 'Bearer {{accessToken}}' },
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                status: 'In Progress',
                note: 'Field inspection completed and patching squad deployed.'
              }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/tickets/CR-2026-8850/status', host: ['{{baseUrl}}'], path: ['api', 'tickets', 'CR-2026-8850', 'status'] }
          }
        },
        {
          name: 'Inspection Action (Field Officer Only)',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{accessToken}}' },
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                action: 'mark_in_progress',
                remarks: 'Excavation completed, asphalt base poured.'
              }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/tickets/CR-2026-8842/inspection', host: ['{{baseUrl}}'], path: ['api', 'tickets', 'CR-2026-8842', 'inspection'] }
          }
        },
        {
          name: 'Citizen Confirm / Dispute Resolution',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{accessToken}}' },
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                decision: 'confirm',
                comment: 'Pothole completely repaired and surface levelled.'
              }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/tickets/CR-2026-8843/confirm', host: ['{{baseUrl}}'], path: ['api', 'tickets', 'CR-2026-8843', 'confirm'] }
          }
        }
      ]
    },
    {
      name: '4. Admin Governance API',
      item: [
        {
          name: 'Platform Overview Metrics',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }],
            url: { raw: '{{baseUrl}}/api/admin/overview', host: ['{{baseUrl}}'], path: ['api', 'admin', 'overview'] }
          }
        },
        {
          name: 'List Users',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }],
            url: { raw: '{{baseUrl}}/api/admin/users?role=field_officer', host: ['{{baseUrl}}'], path: ['api', 'admin', 'users'], query: [{ key: 'role', value: 'field_officer' }] }
          }
        },
        {
          name: 'Create User',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{accessToken}}' },
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                name: 'Kavita Joshi',
                email: 'kavita.joshi@civicreflex.gov.in',
                password: 'OfficerPassword123!',
                role: 'field_officer',
                department: 'Electrical Maintenance',
                ward: 'Ward 22',
                designation: 'Assistant Lighting Inspector',
                phone: '+91 94220 55100'
              }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/admin/users', host: ['{{baseUrl}}'], path: ['api', 'admin', 'users'] }
          }
        },
        {
          name: 'Suspend User',
          request: {
            method: 'PATCH',
            header: [
              { key: 'Authorization', value: 'Bearer {{accessToken}}' },
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({ reason: 'Repeated non-civic commercial advertisement uploads' }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/admin/users/USR-88221/suspend', host: ['{{baseUrl}}'], path: ['api', 'admin', 'users', 'USR-88221', 'suspend'] }
          }
        },
        {
          name: 'Reinstate User',
          request: {
            method: 'PATCH',
            header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }],
            url: { raw: '{{baseUrl}}/api/admin/users/USR-88221/reinstate', host: ['{{baseUrl}}'], path: ['api', 'admin', 'users', 'USR-88221', 'reinstate'] }
          }
        },
        {
          name: 'Moderation Queue',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }],
            url: { raw: '{{baseUrl}}/api/admin/moderation?view=queue', host: ['{{baseUrl}}'], path: ['api', 'admin', 'moderation'], query: [{ key: 'view', value: 'queue' }] }
          }
        },
        {
          name: 'Decide Moderation',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{accessToken}}' },
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                action: 'reject',
                reason: 'Irrelevant commercial flex advertisement.'
              }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/admin/moderation/REP-2026-1057/decision', host: ['{{baseUrl}}'], path: ['api', 'admin', 'moderation', 'REP-2026-1057', 'decision'] }
          }
        },
        {
          name: 'Query Audit Logs',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }],
            url: { raw: '{{baseUrl}}/api/admin/audit-logs?limit=25', host: ['{{baseUrl}}'], path: ['api', 'admin', 'audit-logs'], query: [{ key: 'limit', value: '25' }] }
          }
        },
        {
          name: 'Verify Audit Chain Integrity',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }],
            url: { raw: '{{baseUrl}}/api/admin/audit-logs/verify', host: ['{{baseUrl}}'], path: ['api', 'admin', 'audit-logs', 'verify'] }
          }
        },
        {
          name: 'List Wards',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }],
            url: { raw: '{{baseUrl}}/api/admin/wards', host: ['{{baseUrl}}'], path: ['api', 'admin', 'wards'] }
          }
        },
        {
          name: 'Create Ward',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{accessToken}}' },
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                wardNumber: 'Ward 30',
                wardName: 'Airport Road IT Corridor',
                zone: 'North Zone',
                assignedAuthority: 'Er. Rameshwar Rao'
              }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/admin/wards', host: ['{{baseUrl}}'], path: ['api', 'admin', 'wards'] }
          }
        },
        {
          name: 'Update Ward',
          request: {
            method: 'PATCH',
            header: [
              { key: 'Authorization', value: 'Bearer {{accessToken}}' },
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({ wardName: 'Airport Expressway & Tech Corridor' }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/admin/wards/Ward 30', host: ['{{baseUrl}}'], path: ['api', 'admin', 'wards', 'Ward 30'] }
          }
        },
        {
          name: 'Update Department',
          request: {
            method: 'PATCH',
            header: [
              { key: 'Authorization', value: 'Bearer {{accessToken}}' },
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({ budgetAllocated: '₹5.20 Cr' }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/admin/departments/PWD-ROADS', host: ['{{baseUrl}}'], path: ['api', 'admin', 'departments', 'PWD-ROADS'] }
          }
        },
        {
          name: 'List Admin Categories',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }],
            url: { raw: '{{baseUrl}}/api/admin/categories', host: ['{{baseUrl}}'], path: ['api', 'admin', 'categories'] }
          }
        },
        {
          name: 'Create Category',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{accessToken}}' },
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                name: 'Tree Pruning & Greenery',
                department: 'Roads and Infrastructure',
                defaultPriority: 'Medium',
                defaultSlaHours: 72,
                description: 'Overhanging dangerous branches and fallen trees.'
              }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/admin/categories', host: ['{{baseUrl}}'], path: ['api', 'admin', 'categories'] }
          }
        },
        {
          name: 'Get Settings',
          request: {
            method: 'GET',
            header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }],
            url: { raw: '{{baseUrl}}/api/admin/settings', host: ['{{baseUrl}}'], path: ['api', 'admin', 'settings'] }
          }
        },
        {
          name: 'Update Settings',
          request: {
            method: 'PUT',
            header: [
              { key: 'Authorization', value: 'Bearer {{accessToken}}' },
              { key: 'Content-Type', value: 'application/json' }
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                highSlaHours: 24,
                mediumSlaHours: 48,
                lowSlaHours: 120,
                autoEscalationDays: 3,
                duplicateGeoRadiusMeters: 20
              }, null, 2)
            },
            url: { raw: '{{baseUrl}}/api/admin/settings', host: ['{{baseUrl}}'], path: ['api', 'admin', 'settings'] }
          }
        }
      ]
    },
    {
      name: '5. Public Directory APIs',
      item: [
        {
          name: 'List Active Categories',
          request: {
            method: 'GET',
            url: { raw: '{{baseUrl}}/api/categories', host: ['{{baseUrl}}'], path: ['api', 'categories'] }
          }
        },
        {
          name: 'List Municipal Departments',
          request: {
            method: 'GET',
            url: { raw: '{{baseUrl}}/api/departments', host: ['{{baseUrl}}'], path: ['api', 'departments'] }
          }
        },
        {
          name: 'Health Check',
          request: {
            method: 'GET',
            url: { raw: '{{baseUrl}}/health', host: ['{{baseUrl}}'], path: ['health'] }
          }
        }
      ]
    }
  ]
};

const targetDir = path.join(__dirname, '../../docs');
fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(path.join(targetDir, 'civicreflex.postman_collection.json'), JSON.stringify(collection, null, 2), 'utf8');
console.log('Postman collection successfully generated at server/docs/civicreflex.postman_collection.json');
