# CivicReflex Backend API Documentation

CivicReflex is a citizen-first civic issue reporting, pedestrian safety auditing, and municipal accountability platform built with Node.js, Express, and MongoDB (Mongoose).

---

## 🚀 Quickstart: Running, Seeding & Testing

### 1. Environment Configuration
Create a `.env` file in `server/` with the following variables:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/civicreflex
CLIENT_URL=http://localhost:5173
JWT_ACCESS_SECRET=your_super_secret_jwt_access_key_here
JWT_REFRESH_SECRET=your_super_secret_jwt_refresh_key_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### 2. Available Commands
| Script | Command | Purpose |
| :--- | :--- | :--- |
| **Development** | `npm run dev` | Starts server with live auto-reload via `nodemon`. |
| **Production** | `npm start` | Boots production server process on configured `PORT`. |
| **Database Seed** | `npm run seed` | Populates demo data, wards, departments, categories, and ~320 reports & tickets. |
| **Automated Tests** | `npm test` | Runs complete Jest test suite using an isolated in-memory MongoDB database. |
| **Bootstrap Admin** | `npm run create-admin -- --email <email> --name "<name>" --password "<pass>"` | Creates system administrator without printing passwords. |

---

## 🔐 Authentication & RBAC (Role-Based Access Control)

All secured endpoints authenticate the caller via JSON Web Tokens (JWT) passed in the standard `Authorization` header:

```http
Authorization: Bearer <access_token>
```

### Supported User Roles
- `citizen`: Can register, report civic grievances, view public reports, verify community reports, and confirm/dispute resolution on tickets they created.
- `field_officer`: Can view assigned tickets, execute chronological site inspection workflows, upload photo evidence, and mark tickets as In Progress and Resolved.
- `authority`: Can assign tickets to officers and departments, update SLA priorities, and oversee municipal operational resolution.
- `admin`: Universal supervisor. Can manage user accounts, suspend/reinstate users, oversee report moderation queues, configure wards/categories/settings, and audit cryptographic logs.

---

## 🚦 Status Lifecycle & State Transitions

Tickets follow a strict state transition table enforced in `src/constants/ticketTransitions.js`:

| Current Status | Allowed Target Statuses | Allowed Role |
| :--- | :--- | :--- |
| **Reported** | `Verified`, `Under Review`, `Assigned`, `Escalated` | Authority / Admin |
| **Verified** | `Verified`, `Under Review`, `Assigned`, `Escalated` | Authority / Admin |
| **Under Review** | `Verified`, `Under Review`, `Assigned`, `Escalated` | Authority / Admin |
| **Assigned** | `In Progress` | Field Officer (assigned officer only) |
| **Assigned** | `Escalated`, `Assigned` (reassign) | Authority / Admin |
| **In Progress** | `Resolved` | Field Officer (assigned officer only) |
| **In Progress** | `Escalated` | Authority / Admin |
| **Resolved** | `Citizen-Confirmed`, `Reopened - Under Investigation` | Citizen (ticket creator only) |
| **Reopened - Under Investigation** | `Assigned` | Authority / Admin |
| **Escalated** | `Assigned`, `Under Review` | Authority / Admin |
| **Citizen-Confirmed** | *(None - terminal state)* | None |

---

## 📢 Real-Time Events

The server announces operational lifecycle milestones using an internal decoupled event emitter (`src/utils/events.js`):

| Event Name | Trigger Condition | Payload Summary |
| :--- | :--- | :--- |
| `report.created` | New report submitted and ticket generated | `{ reportId, ticketNumber }` |
| `report.verified` | Citizen verifies community report | `{ reportId, userId, verifiedCount }` |
| `ticket.assigned` | Ticket assigned to field officer | `{ ticketNumber, officerId }` |
| `ticket.statusChanged` | Ticket transitions to a new lifecycle status | `{ ticketNumber, fromStatus, toStatus, by }` |

---

## 📚 Complete API Endpoints Catalog

### 1. Authentication API (`/api/auth`)

#### `POST /api/auth/register`
- **Access:** Public
- **Status Codes:** `201 Created`, `400 Bad Request`, `409 Conflict`
- **Request Body:**
```json
{
  "name": "Ananya Roy",
  "email": "ananya.roy@civicreflex.demo",
  "password": "citizen123",
  "phone": "+91 98200 44821",
  "ward": "Ward 14"
}
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "userCode": "USR-1005",
    "name": "Ananya Roy",
    "email": "ananya.roy@civicreflex.demo",
    "role": "citizen",
    "ward": "Ward 14",
    "accountStatus": "Active"
  }
}
```

#### `POST /api/auth/login`
- **Access:** Public (Rate Limited: 10 attempts / 15 min / IP)
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden` (Suspended)
- **Request Body:**
```json
{
  "email": "citizen@civicreflex.gov.in",
  "password": "citizen123"
}
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "USR-88219",
      "name": "Vikram R. Sharma",
      "email": "citizen@civicreflex.gov.in",
      "role": "citizen",
      "ward": "Ward 14 (South Zone)"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### `POST /api/auth/refresh`
- **Access:** Public
- **Status Codes:** `200 OK`, `401 Unauthorized`
- **Request Body:** `{ "refreshToken": "<token>" }`

#### `GET /api/auth/me`
- **Access:** Authenticated (Bearer Token)
- **Status Codes:** `200 OK`, `401 Unauthorized`

#### `POST /api/auth/change-password`
- **Access:** Authenticated
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`
- **Request Body:**
```json
{
  "currentPassword": "oldPassword123!",
  "newPassword": "newSecurePassword456!"
}
```

#### `POST /api/auth/logout`
- **Access:** Authenticated
- **Status Codes:** `200 OK`, `401 Unauthorized`

---

### 2. Reports API (`/api/reports`)

#### `POST /api/reports`
- **Access:** Authenticated (`citizen`, `authority`, `field_officer`, `admin`)
- **Headers:** `Idempotency-Key` (Optional client deduplication key)
- **Status Codes:** `201 Created`, `400 Bad Request`, `401 Unauthorized`
- **Request Body:**
```json
{
  "title": "Deep pothole near junction",
  "category": "Road Damage / Potholes",
  "subcategory": "Pothole Repair",
  "location": "Opposite State Bank ATM, Ward 14, M.G. Road",
  "wardNumber": "Ward 14",
  "zone": "South Zone",
  "landmark": "Near Metro Pillar 12",
  "severity": "High",
  "timeOfDay": "Evening",
  "latitude": 18.5050,
  "longitude": 73.8550,
  "description": "Severe road crater approx 1.5m wide causing extreme hazards."
}
```
*(System-controlled fields such as `status`, `upvotes`, and `verifiedCount` are stripped and rejected if submitted by the client.)*
- **Response:**
```json
{
  "success": true,
  "data": {
    "reportId": "REP-2026-1060",
    "ticketNumber": "CR-2026-9001",
    "title": "Deep pothole near junction",
    "status": "Reported",
    "upvotes": 0,
    "verifiedCount": 0
  }
}
```

#### `GET /api/reports`
- **Access:** Public (Optional Auth: authorities receive unblurred anonymous coordinates)
- **Query Parameters:** `wardNumber`, `category`, `status`, `type`, `timeOfDay`, `search`, `bbox`, `cursor`, `limit` (max 50, default 20), `page`
- **Status Codes:** `200 OK`, `400 Bad Request`
- **Response Structure (Cursor Pagination):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "REP-2026-1049",
        "ticketNumber": "CR-2026-8842",
        "title": "Deep crater-sized pothole near junction",
        "category": "Road Damage / Potholes",
        "wardNumber": "Ward 14",
        "status": "In Progress",
        "severity": "High",
        "upvotes": 42,
        "verifiedCount": 18
      }
    ],
    "nextCursor": "MjAyNi0xMC0yOFQwMzo0NTowMC4wMDBafDY3NDYy...",
    "page": 1,
    "limit": 20,
    "total": 320
  }
}
```

#### `GET /api/reports/:id`
- **Access:** Public
- **Status Codes:** `200 OK`, `404 Not Found`

#### `POST /api/reports/:id/verify`
- **Access:** Authenticated (1 vote per user)
- **Status Codes:** `200 OK`, `401 Unauthorized`, `404 Not Found`, `409 Conflict` (Already verified)

#### `POST /api/reports/:id/flag`
- **Access:** Authenticated
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`
- **Request Body:** `{ "reason": "Inappropriate non-civic advertisement" }`

---

### 3. Tickets API (`/api/tickets`)

#### `GET /api/tickets`
- **Access:** Authority / Admin (all tickets), Field Officer (assigned tickets only). Citizens receive `403 Forbidden`.
- **Query Parameters:** `currentStatus`, `ward`, `category`, `assignedOfficerId`, `cursor`, `limit` (max 50), `page`
- **Status Codes:** `200 OK`, `401 Unauthorized`, `403 Forbidden`

#### `GET /api/tickets/:ticketNumber`
- **Access:** Public (Tracking portal lookup)
- **Status Codes:** `200 OK`, `404 Not Found`

#### `POST /api/tickets/:ticketNumber/assign`
- **Access:** Authority / Admin only
- **Status Codes:** `200 OK`, `400 Bad Request`, `403 Forbidden`, `404 Not Found`
- **Request Body:**
```json
{
  "department": "Roads and Infrastructure",
  "officerId": "OFF-PWD-014",
  "officerName": "Mr. V. Nair",
  "designation": "Junior Engineer (Roads)",
  "contact": "officer.pwd@civicreflex.gov.in",
  "priority": "High",
  "directives": "Execute cold-mix patching within 24 hours."
}
```

#### `PATCH /api/tickets/:ticketNumber/status`
- **Access:** RBAC per State Machine
- **Status Codes:** `200 OK`, `400 Bad Request`, `403 Forbidden`, `404 Not Found`, `409 Conflict` (Invalid jump)
- **Request Body:**
```json
{
  "status": "In Progress",
  "note": "Field inspection conducted; road compaction underway."
}
```

#### `POST /api/tickets/:ticketNumber/inspection`
- **Access:** Field Officer only (assigned officer)
- **Status Codes:** `200 OK`, `400 Bad Request`, `403 Forbidden`
- **Request Body Actions:** `start_inspection`, `submit_remarks`, `mark_in_progress`, `upload_before_photo`, `upload_after_photo`, `submit_completion`

#### `POST /api/tickets/:ticketNumber/confirm`
- **Access:** Citizen (Grievance creator only)
- **Status Codes:** `200 OK`, `400 Bad Request`, `403 Forbidden`, `409 Conflict` (Ticket not Resolved)
- **Request Body:**
```json
{
  "decision": "confirm",
  "comment": "Work order inspected and confirmed resolved."
}
```

---

### 4. Admin Governance API (`/api/admin` - Admin Only)

| Method | Endpoint | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/overview` | Aggregated metrics (users, reports, tickets, wards). | `200` |
| `GET` | `/api/admin/users` | Filter and paginate system user directory. | `200` |
| `POST` | `/api/admin/users` | Provision user account of any role. | `201, 400, 409` |
| `PATCH`| `/api/admin/users/:id/suspend` | Suspend user with mandatory reason. | `200, 400, 404` |
| `PATCH`| `/api/admin/users/:id/reinstate` | Restore suspended user to Active. | `200, 404` |
| `GET` | `/api/admin/moderation` | Moderation queue (`?view=queue` or `history`). | `200` |
| `POST` | `/api/admin/moderation/:reportId/decision` | Moderate report (`approve`, `reject`, `duplicate`, `clarify`, `escalate`). | `200, 400, 404` |
| `GET` | `/api/admin/audit-logs` | Query append-only audit trail (`?format=csv`). | `200` |
| `GET` | `/api/admin/audit-logs/verify` | Verifies SHA-256 chain integrity (`intact`/`broken`). | `200` |
| `GET` | `/api/admin/wards` | List wards with grievance resolution stats. | `200` |
| `POST` | `/api/admin/wards` | Create administrative municipal ward. | `201, 400, 409` |
| `PATCH`| `/api/admin/wards/:wardNumber` | Update municipal ward parameters. | `200, 404` |
| `PATCH`| `/api/admin/departments/:code` | Update municipal department budget/officer. | `200, 404` |
| `GET` | `/api/admin/categories` | List all grievance categories (active/inactive). | `200` |
| `POST` | `/api/admin/categories` | Create new issue category. | `201, 400, 409` |
| `PATCH`| `/api/admin/categories/:id` | Update category SLA hours and status. | `200, 404` |
| `GET` | `/api/admin/settings` | Retrieve portal settings document. | `200` |
| `PUT` | `/api/admin/settings` | Update settings and live SLA thresholds. | `200, 400` |

---

### 5. Public Directory APIs

- **`GET /api/categories`:** Returns active categories for issue filing forms (`200 OK`).
- **`GET /api/departments`:** Returns municipal departments directory (`200 OK`).
- **`GET /health`:** Health check endpoint returning `{ "success": true, "data": { "status": "ok" } }` (`200 OK`).

---

## 🌱 Database Seeding (`npm run seed`)

Populates the database with realistic municipal demo data, administrative configurations, and user accounts:

```bash
npm run seed
```

- **Safety:** Automatically aborts if `NODE_ENV === 'production'`.
- **Idempotency:** Purges only documents flagged with `isSeed: true` before inserting, ensuring zero duplicate accumulation across repeated executions.
- **Demo Accounts:**
  - Citizen: `citizen@civicreflex.gov.in` (`citizen123`)
  - Authority: `authority@civicreflex.gov.in` (`authority123`)
  - Field Officer: `officer.pwd@civicreflex.gov.in` (`officer123`)
  - Admin: `admin@civicreflex.gov.in` (`admin123`)
- **Seeded Dataset:**
  - 6 Administrative Wards and 5 Municipal Departments
  - 8 Grievance & Illumination Categories
  - Municipal Settings document
  - 22 Users (including 10 active citizen reporters)
  - 320 Reports & 320 Grievance Tickets spanning 12 lifecycle statuses
  - 12 Overdue SLA tickets in Assigned/In Progress with past resolution dates
  - 2 Geo-spatial Night-Time Illumination Clusters (6 reports within 150m in Ward 08, 3 reports within 150m in Ward 14)
- **Sequence Counters:** Automatically synchronized to prevent future ID collision.

---

## 🧪 Automated Testing (`npm test`)

The backend includes a comprehensive Jest test suite powered by `supertest` and an isolated in-memory MongoDB server (`mongodb-memory-server`):

```bash
npm test
```

- **Airtight Safety Guard:** The test runner strictly verifies that `MONGO_URI` never points to remote MongoDB Atlas (`mongodb.net`) and immediately aborts if remote connection strings are detected.
- **Scope & Isolation:** Scoped strictly to `server/tests/**/*.test.js`, preventing any execution of manual developer scripts. All collections are purged between individual test cases.
- **Coverage Areas:**
  - **Authentication & RBAC (`tests/auth.test.js`):** Citizen registration, login validation, credential rejections (wrong password, account suspension), unauthenticated 401 gates, and unauthorized 403 role restrictions.
  - **Reports Validation (`tests/reports.test.js`):** Stripping client-controlled status/upvote fields, idempotency key deduplication, single-vote citizen verification logic (409 on duplicate), and cursor pagination.
  - **Ticket Lifecycle & State Machine (`tests/tickets.test.js`):** Full 5-stage progression (Reported $\rightarrow$ Assigned $\rightarrow$ In Progress $\rightarrow$ Resolved $\rightarrow$ Citizen-Confirmed), prohibiting invalid jumps (Reported $\rightarrow$ Resolved 409), enforcing officer ticket ownership (403), and blocking officer confirmation (403).
  - **Moderation & Tamper-Evident Audit (`tests/admin-moderation-audit.test.js`):** Enforcing mandatory moderation rejection reasons (400), cryptographic SHA-256 hash chain verification, and historical block tampering detection.

---

## ⚡ Performance, Safety & Cursor Pagination

### 1. Response Compression & Rate Limiting
- **Gzip/Deflate Compression (`compression`):** Applied globally to compress JSON responses, dramatically reducing wire bandwidth usage.
- **General Rate Limiter (`express-rate-limit`):** 200 requests per 15 minutes per IP protecting general endpoints against denial-of-service spikes. Automatically bypassed in `NODE_ENV === 'test'`.
- **Auth Rate Limiter:** 10 login attempts per 15 minutes per IP protecting `/api/auth/login`.

### 2. Cursor Pagination & Lean Projections
- **`GET /api/reports` & `GET /api/tickets`:**
  - Query parameters: `limit` (capped at max 50, default 20) and `cursor`.
  - Sorted newest first with `_id` as strict tie-breaker (`{ reportedAt: -1, _id: -1 }` and `{ submissionDate: -1, _id: -1 }`).
  - Response structure: `{ items, nextCursor, total, page, limit }` keeping backwards compatibility when `cursor` is omitted.
  - **Lean Execution & Field Projections:** Utilizes Mongoose `.lean()` and targeted field projections (`select(...)`), avoiding full document hydration overhead and omitting massive internal audit arrays (`actionsTaken`, `moderationHistory`, `timeline`) from list payloads. Single-item endpoints retain 100% full detail.

### 3. Database Indexes & Query Explain
- **Report Query (`wardNumber`, `status`, `reportedAt`, `_id`):** Covered by compound index `wardNumber_1_status_1_reportedAt_-1__id_-1`, executing via `IXSCAN` with zero in-memory sorting.
- **Ticket Query (`currentStatus`, `ward`, `submissionDate`, `_id`):** Covered by compound index `currentStatus_1_ward_1_submissionDate_-1__id_-1`, executing via `IXSCAN`.
- **Response Time Benchmark:** Projections and `.lean()` execution achieved a measurable latency reduction across 50 iterations on the seeded dataset.
