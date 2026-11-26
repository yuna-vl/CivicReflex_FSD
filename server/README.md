# CivicReflex Backend API Documentation

CivicReflex is a citizen-first civic issue reporting, pedestrian safety auditing, and municipal accountability platform built with Express and MongoDB (Mongoose).

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
- `admin`: Universal supervisor. Can do everything an authority can do, plus manage user accounts, suspend/reinstate users, oversee report moderation queues, configure wards/categories/settings, and audit cryptographic logs.

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
| **Resolved** | `Citizen-Confirmed`, `Reopened - Under Investigation` | Citizen (ticket creator only) |
| **Reopened - Under Investigation** | `Assigned` | Authority / Admin |
| **Escalated** | `Assigned`, `Under Review` | Authority / Admin |
| **Citizen-Confirmed** | *(None - terminal state)* | None |

---

## ⏱️ Service Level Agreement (SLA) Thresholds

Resolution deadlines are calculated dynamically from settings configured in the portal:
- **Critical / High:** Configured via `highSlaHours` (default 24h)
- **Medium:** Configured via `mediumSlaHours` (default 48h)
- **Low:** Configured via `lowSlaHours` (default 120h / 5 days)

---

## 🛡️ Tamper-Evident Audit Trail

Every sensitive action records a cryptographically hashed block containing:
`prevHash` (SHA-256 of the prior block) + block content $\rightarrow$ `hash`.
Any modification or deletion of past records breaks the hash chain, immediately reported via `GET /api/admin/audit-logs/verify`.

---

## 📚 API Endpoints Catalog

### 1. Authentication API (`/api/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register new citizen account (password min 8 chars). |
| `POST` | `/api/auth/login` | Public (Rate Limited) | Authenticate credentials; returns access & refresh tokens. |
| `POST` | `/api/auth/refresh` | Public | Rotates refresh token and returns new token pair. Detects token reuse. |
| `POST` | `/api/auth/logout` | Authenticated | Clears active refresh session. |
| `GET` | `/api/auth/me` | Authenticated | Returns profile of authenticated user. |
| `POST` | `/api/auth/change-password` | Authenticated | Change account password with current and new password. |

---

### 2. Reports API (`/api/reports`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/reports` | Authenticated | Lodge civic report. Links `createdBy` to caller. |
| `GET` | `/api/reports` | Public | List reports. Supports `bbox` map search. Anonymous reports blurred for public, unblurred for authority. |
| `GET` | `/api/reports/:id` | Public | Report details by reportId (e.g. `REP-2026-1001`). |
| `POST` | `/api/reports/:id/verify` | Authenticated | Vote / verify report (1 vote per user). |
| `POST` | `/api/reports/:id/flag` | Authenticated | Flag report with reason for moderation review. |

---

### 3. Tickets API (`/api/tickets`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tickets` | Authority / Admin / Officer | List tickets. Officers see only assigned; citizens receive 403. |
| `GET` | `/api/tickets/:ticketNumber`| Public | Public grievance lookup by ticket number (e.g. `CR-2026-9001`). |
| `PATCH`| `/api/tickets/:ticketNumber/status` | RBAC | Update lifecycle status per state machine. |
| `POST` | `/api/tickets/:ticketNumber/assign` | Authority / Admin | Assign ticket to department and field officer. |
| `POST` | `/api/tickets/:ticketNumber/inspection` | Field Officer | Execute inspection actions (start, remarks, mark in progress, photos, completion). |
| `POST` | `/api/tickets/:ticketNumber/confirm` | Citizen (Creator) | Citizen confirms resolution or disputes (reopens). |

---

### 4. Admin Governance API (`/api/admin` - Admin Only)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/users` | List users with search, role filters, and sorting. |
| `POST` | `/api/admin/users` | Create user of any role with credentials. |
| `PATCH`| `/api/admin/users/:id/suspend` | Suspend user with reason (clears sessions, prevents login). |
| `PATCH`| `/api/admin/users/:id/reinstate` | Restore suspended user to Active. |
| `GET` | `/api/admin/audit-logs` | Query audit trail (`?format=csv` downloads CSV). |
| `GET` | `/api/admin/audit-logs/verify` | Verifies SHA-256 chain integrity. |
| `GET` | `/api/admin/moderation` | Moderation queue (`?view=queue` or `?view=history`). |
| `POST` | `/api/admin/moderation/:reportId/decision` | Moderate report (`approve`, `reject`, `duplicate`, `clarify`, `escalate`). |
| `GET` | `/api/admin/wards` | List wards with aggregate grievance resolution metrics. |
| `POST` | `/api/admin/wards` | Create new municipal ward. |
| `PATCH`| `/api/admin/wards/:wardNumber` | Update municipal ward. |
| `PATCH`| `/api/admin/departments/:code` | Update municipal department details. |
| `GET` | `/api/admin/categories` | List all grievance categories (active & inactive). |
| `POST` | `/api/admin/categories` | Create new grievance category. |
| `PATCH`| `/api/admin/categories/:id` | Update category details and SLA thresholds. |
| `GET` | `/api/admin/settings` | Retrieve portal settings and SLA thresholds. |
| `PUT` | `/api/admin/settings` | Update portal settings (updates live SLA thresholds). |
| `GET` | `/api/admin/overview` | Platform overview counts (users, reports, tickets by status, moderation, wards). |

---

### 5. Categories API (`/api/categories`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/categories` | Public | Returns active grievance categories for report lodging forms. |

---

## 🛠️ Administrative CLI Tools

### Create System Administrator
Bootstrap an administrator account without exposing passwords:

```bash
npm run create-admin -- --email admin@civicreflex.gov.in --name "System Administrator" --password "YourStrongPasswordHere!"
```
