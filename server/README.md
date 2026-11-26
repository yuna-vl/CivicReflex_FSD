# CivicReflex Backend API Documentation

CivicReflex is a citizen-first civic issue reporting, pedestrian safety auditing, and municipal accountability platform built with Express and MongoDB (Mongoose).

---

## 🔐 Temporary Actor Authentication Headers

Until full JWT authentication is implemented in `feature/auth-admin`, secured ticket endpoints authenticate caller identity using custom HTTP request headers:

| Header | Description | Allowed Values |
| :--- | :--- | :--- |
| `x-actor-role` | Operational caller role | `citizen`, `authority`, `field_officer`, `admin` |
| `x-actor-id` | Unique ID of the caller | Non-empty string (e.g. `user_123`, `OFF-401`) |
| `x-actor-name` | Full name of the caller | Non-empty string (e.g. `Jane Doe`, `R. K. Sharma`) |

> [!NOTE]
> `admin` inherits all permissions granted to `authority`. If any actor header is missing or the role is invalid, the API returns **401 Unauthorized** with `{"success": false, "error": {"message": "Missing or invalid actor headers"}}`.

---

## 🚦 Status Lifecycle & Role Transitions

Tickets follow a strict state transition table:

| Current Status | Allowed Target Statuses | Allowed Role |
| :--- | :--- | :--- |
| **Reported** | `Verified`, `Under Review`, `Assigned`, `Escalated` | Authority / Admin |
| **Verified** | `Verified`, `Under Review`, `Assigned`, `Escalated` | Authority / Admin |
| **Under Review** | `Verified`, `Under Review`, `Assigned`, `Escalated` | Authority / Admin |
| **Assigned** | `In Progress` | Field Officer (assigned officer only) |
| **Assigned** | `Escalated`, `Assigned` (reassign) | Authority / Admin |
| **In Progress** | `Resolved` | Field Officer (assigned officer only) |
| **In Progress** | `Escalated` | Authority / Admin |
| **Resolved** | `Citizen-Confirmed`, `Reopened - Under Investigation` | Citizen |
| **Reopened - Under Investigation** | `Assigned` | Authority / Admin |
| **Escalated** | `Assigned`, `Under Review` | Authority / Admin |
| **Citizen-Confirmed** | *(None - terminal state)* | None |

---

## ⏱️ Service Level Agreement (SLA) Thresholds

Expected resolution dates are computed automatically from report submission time:
- **Critical:** 24 Hours
- **High:** 24 Hours
- **Medium:** 48 Hours
- **Low:** 120 Hours (5 Days)

---

## 📚 API Endpoints Catalog

### 1. System Health

#### `GET /health`
- **Access:** Public
- **Success Reply (200 OK):**
```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

---

### 2. Reports API (`/api/reports`)

#### `POST /api/reports`
- **Access:** Public / Citizen
- **Headers:** Optional `Idempotency-Key` for replay protection.
- **Request Body:**
```json
{
  "title": "Broken Streetlight on 2nd Main",
  "category": "Street Lighting",
  "subcategory": "Pole Damaged",
  "description": "Entire stretch dark for two nights",
  "wardNumber": "Ward 14",
  "location": "2nd Main Road, Indiranagar",
  "severity": "High",
  "latitude": 12.9716,
  "longitude": 77.5946
}
```
- **Success Reply (201 Created):**
```json
{
  "success": true,
  "data": {
    "reportId": "REP-2026-1001",
    "ticketNumber": "CR-2026-9001",
    "title": "Broken Streetlight on 2nd Main",
    "status": "Reported",
    "severity": "High",
    "slaTargetDate": "2026-11-26T14:00:00.000Z",
    "upvotes": 0,
    "verifiedCount": 0,
    "id": "REP-2026-1001"
  }
}
```
*(Idempotent retry with same `Idempotency-Key` returns 200 OK with the existing report)*.

#### `GET /api/reports`
- **Access:** Public
- **Query Params:** `wardNumber`, `type`, `category`, `status`, `timeOfDay`, `search`, `page` (default 1), `limit` (default 20, max 50).
- **Success Reply (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

#### `GET /api/reports/:id`
- **Access:** Public
- **Success Reply (200 OK):** Report object or **404 Not Found**.

#### `POST /api/reports/:id/verify`
- **Access:** Citizen
- **Request Body:** `{ "userId": "usr_9982" }`
- **Success Reply (200 OK):** Increments `verifiedCount` by 1 and records user.
- **Error Reply (409 Conflict):** `{"success": false, "error": {"message": "You have already verified this report"}}`.

---

### 3. Departments API (`/api/departments`)

#### `GET /api/departments`
- **Access:** Public
- **Success Reply (200 OK):** Array of departments sorted by name.

#### `GET /api/departments/:code`
- **Access:** Public
- **Success Reply (200 OK):** Single department or **404 Not Found**.

#### `POST /api/departments`
- **Access:** Authority / Admin
- **Request Body:**
```json
{
  "name": "Public Works Department",
  "code": "PWD-ROADS",
  "nodalOfficer": "R. K. Sharma",
  "officerCount": 24,
  "budgetAllocated": "₹85,00,000",
  "contactEmail": "pwd.roads@civicreflex.gov.in"
}
```
- **Success Reply (201 Created):** Department object.
- **Error Reply (409 Conflict):** If department code already exists.

---

### 4. Tickets API (`/api/tickets`)

#### `GET /api/tickets`
- **Access:** Authority / Admin / Field Officer
- **Query Params:** `currentStatus`, `ward`, `category`, `assignedOfficerId`, `page` (default 1), `limit` (default 20, max 50).
- **Success Reply (200 OK):** Paginated tickets sorted newest first.

#### `GET /api/tickets/:ticketNumber`
- **Access:** Public Tracking
- **Success Reply (200 OK):** Complete ticket document including 6-stage timeline and inspection data, or **404 Not Found**.

#### `PATCH /api/tickets/:ticketNumber/status`
- **Access:** Actor role determined by the transition table
- **Headers:** `x-actor-role`, `x-actor-id`, `x-actor-name`
- **Request Body:**
```json
{
  "status": "Under Review",
  "note": "Awaiting engineer confirmation"
}
```
- **Success Reply (200 OK):** Updated ticket.
- **Error Replies:**
  - **403 Forbidden:** If role or ownership is not permitted.
  - **409 Conflict:** If transition is invalid in lifecycle or concurrent modification occurred.

#### `POST /api/tickets/:ticketNumber/assign`
- **Access:** Authority / Admin
- **Headers:** `x-actor-role: authority`, `x-actor-id`, `x-actor-name`
- **Request Body:**
```json
{
  "department": "Public Works Department",
  "officerId": "OFF-101",
  "officerName": "A. K. Verma",
  "designation": "Assistant Executive Engineer",
  "contact": "+91-9876543210",
  "priority": "High",
  "directives": "Inspect immediately and report within 24 hours"
}
```
- **Success Reply (200 OK):** Assigned ticket with updated officer, authority, and SLA deadline.

#### `POST /api/tickets/:ticketNumber/inspection`
- **Access:** Field Officer (assigned officer only)
- **Headers:** `x-actor-role: field_officer`, `x-actor-id: OFF-101`, `x-actor-name: A. K. Verma`
- **Supported Actions:**
  1. `start_inspection`: Sets `inspection.startedAt` (Status must be `Assigned`).
  2. `submit_remarks`: Stores remarks (Inspection must be started).
  3. `mark_in_progress`: Transitions `Assigned -> In Progress` (Inspection must be started).
  4. `upload_before_photo`: Stores `beforePhotoUrl`.
  5. `upload_after_photo`: Stores `afterPhotoUrl` (Status must be `In Progress`).
  6. `submit_completion`: Transitions `In Progress -> Resolved`, sets `completedAt` (Requires `afterPhotoUrl`).
- **Success Reply (200 OK):** Updated ticket document.
- **Error Replies:**
  - **403 Forbidden:** If caller is not the assigned officer.
  - **409 Conflict:** If steps are executed out of chronological order.

#### `POST /api/tickets/:ticketNumber/confirm`
- **Access:** Citizen
- **Headers:** `x-actor-role: citizen`, `x-actor-id`, `x-actor-name`
- **Request Body (Confirm):**
```json
{
  "decision": "confirm",
  "comment": "Pothole filled and road surface restored smoothly."
}
```
*(Moves status from `Resolved -> Citizen-Confirmed`)*.
- **Request Body (Dispute):**
```json
{
  "decision": "dispute",
  "comment": "Rubble left on footpath, drain still blocked."
}
```
*(Moves status from `Resolved -> Reopened - Under Investigation`)*.

