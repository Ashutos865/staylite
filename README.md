# StayLite — Hotel Management SaaS

A full-stack, multi-tenant hotel management platform with a public guest booking portal, staff dashboards, real-time developer observability console, in-app notification system, support ticket system, and maintenance mode — built for the Indian hospitality market.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Lucide Icons, React Router v6 |
| Backend | Node.js, Express 5, Mongoose 9 (CommonJS) |
| Database | MongoDB Atlas (replica set required for transactions) |
| Auth | JWT access tokens (2h) + Refresh tokens (7d, bcrypt-hashed in DB) |
| Payments | Cashfree Payment Gateway v3 (sandbox + production) |
| File Storage | Cloudflare R2 (S3-compatible, via `@aws-sdk/client-s3`) |
| QR Codes | `qrcode` npm package (browser-side generation) |
| Validation | express-validator |
| Rate Limiting | express-rate-limit (authenticated requests bypass general limiter) |
| Exports | xlsx, jsPDF + jspdf-autotable |
| Logging | Custom MongoDB request logger with TTL index (30-day auto-purge) |
| Audio | Web Audio API (zero-dependency checkout beep for managers) |

---

## Project Structure

```
hotel-management-system/
├── backend/
│   ├── middleware/
│   │   ├── authMiddleware.js       # JWT verify + role guards (verifyToken, requireRole, requireAnyRole)
│   │   ├── rateLimiters.js         # General + auth-specific rate limiters (skip for authenticated)
│   │   └── requestLogger.js       # Logs every API request to MongoDB (method, route, status, timing)
│   ├── models/
│   │   ├── User.js                 # 4-role user model + refresh token + subscription limits + suspension
│   │   ├── Property.js             # Hotel model (name, address, photos[], amenities[], status incl. SUSPENDED)
│   │   ├── Room.js                 # Room inventory (category, capacity, basePrice, currentStatus)
│   │   ├── Booking.js              # Booking engine (multi-room, online+walkin, payment ledger)
│   │   ├── Log.js                  # API request log (TTL 30 days)
│   │   ├── UploadToken.js          # Single-use QR upload tokens (TTL 15 minutes)
│   │   ├── Notification.js         # In-app notification (scheduling, repeat config, clearedBy TTL)
│   │   ├── SupportTicket.js        # Support ticket (thread, reporterViewedAt 15h auto-hide)
│   │   └── MaintenanceMode.js      # Maintenance mode (immediate or scheduled start/end)
│   ├── routes/
│   │   ├── authRoutes.js           # Login (maintenance check), refresh token, logout
│   │   ├── adminRoutes.js          # Super admin: create/edit/suspend owners+developers
│   │   ├── propertyRoutes.js       # Hotel + room CRUD, photo upload/delete (R2)
│   │   ├── bookingRoutes.js        # Full booking engine (create, assign, status, CRM, export)
│   │   ├── publicRoutes.js         # Public guest portal (search hotels, availability, book, pay)
│   │   ├── developerRoutes.js      # Developer console + maintenance mode toggle
│   │   ├── notificationRoutes.js   # In-app notifications (send, inbox, read+clear, scheduling)
│   │   └── supportRoutes.js        # Support tickets (raise, view, reply, checkout alerts)
│   ├── utils/
│   │   └── r2.js                   # Cloudflare R2 upload/delete helpers
│   ├── uploads/                    # Legacy — no longer used (storage moved to R2)
│   ├── server.js                   # Express app entry point + public /api/maintenance-status endpoint
│   ├── .env                        # Environment variables (never commit)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx               # Staff login form + maintenance mode banner
│   │   │   ├── AdminDashboard.jsx      # Super admin panel (edit/suspend/delete owners + developers)
│   │   │   ├── OwnerDashboard.jsx      # Property owner panel (hotel CRUD, photo upload, manager mgmt)
│   │   │   ├── BookingInflow.jsx       # Manual booking creation (CRM, QR ID upload, ONLINE badge)
│   │   │   ├── Inventory.jsx           # Room grid + booking queue (assign, check-in/out, ID proof)
│   │   │   ├── Summary.jsx             # Analytics: occupancy, revenue, online stats, Excel/PDF export
│   │   │   ├── BookingCalendar.jsx     # Calendar view (month grid, date detail, guest search)
│   │   │   ├── DeveloperDashboard.jsx  # Dev console (logs, errors, DB, API, system, hotels, users, support, maintenance)
│   │   │   ├── GuestPortal.jsx         # Public booking portal (search, book, Cashfree pay, track)
│   │   │   ├── IDUploadPage.jsx        # Phone-optimized ID proof upload page (QR target)
│   │   │   ├── NotificationBell.jsx    # In-app bell (compose+schedule, inbox, URGENT modal, toast)
│   │   │   └── SupportWidget.jsx       # Floating support widget (raise tickets, view replies)
│   │   ├── App.jsx                     # Root router + maintenance overlay + checkout beep hook
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
└── README.md
```

---

## User Roles

| Role | What They Can Do |
|---|---|
| `SUPER_ADMIN` | Create/edit/suspend property owners + developers, god-view all hotels + bookings, send notifications to owners/managers |
| `PROPERTY_OWNER` | Create hotels (up to subscription limit), manage rooms + photos, manage managers, send notifications to their managers |
| `HOTEL_MANAGER` | Manage bookings for assigned property — create, assign rooms, check-in/out. Receives checkout beep alert |
| `DEVELOPER` | Full developer console — logs, errors, DB stats, API analytics, user/hotel access control, maintenance mode, support tickets |

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas (replica set required for transactions)

### 1. Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>
JWT_SECRET=your_super_secret_jwt_key

# Cashfree Payment Gateway
CASHFREE_APP_ID=TEST_xxxxxxxxxxxxxxxxxxxx
CASHFREE_SECRET_KEY=cfsk_ma_test_xxxxxxxxxxxxxxxxxxxx
CASHFREE_ENV=TEST

# Frontend URL (used in Cashfree return_url)
FRONTEND_URL=http://localhost:5173

# Cloudflare R2 — fill in when you create the bucket
CF_R2_ACCOUNT_ID=
CF_R2_ACCESS_KEY_ID=
CF_R2_SECRET_ACCESS_KEY=
CF_R2_BUCKET_NAME=
CF_R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev

# DB storage warning threshold (default: 512 MB = MongoDB Atlas free tier)
DB_STORAGE_LIMIT_MB=512
```

Start the server:
```bash
npm run dev     # development (nodemon)
npm start       # production
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`, backend at `http://localhost:5000`.

### 3. Create Super Admin (One Time Only)

```
GET http://localhost:5000/api/admin/setup
```

Default credentials: `admin@ties.com` / `admin123`

**Change the password after first login.** Returns 404 in production (`NODE_ENV=production`).

---

## Routing Architecture

The frontend uses a **path-based portal split**:

```
STAFF_PATHS = ['/login', '/admin', '/properties', '/inflow', '/calendar',
               '/inventory', '/summary', '/developer']

/login, /admin, /inflow, etc.  →  Staff Portal (requires JWT)
/upload-id/:token              →  IDUploadPage (public, phone QR target)
/ (everything else)            →  Guest Portal (public, no auth)
```

If maintenance mode is active, non-developer/admin staff see a full-screen maintenance overlay instead of the staff portal. Login is blocked for those roles with a 503 response containing the maintenance message.

---

## Features (Complete)

### Guest Booking Portal (`/`)
- Hotel search by name, address, or city
- Hotel detail page with photo gallery (Cloudflare R2 images + Unsplash fallback)
- Room categories with pricing (Standard Non-AC, Deluxe AC, Premium Suite)
- **Real-time availability check** on date selection
- "FULLY BOOKED" overlay on sold-out categories
- "Only X left!" badge when ≤ 2 rooms available
- Booking form with guest details, dates, room type
- **Cashfree Payment Gateway** (sandbox + production)
- Track Booking modal — enter booking ID to see status, rooms, payment
- SEO: title, meta, OG tags, Twitter Card, JSON-LD schema

### Staff Authentication
- JWT access token (2h) + Refresh token (7d, bcrypt-hashed)
- Auto refresh on app load when token within 10 min of expiry
- Server-side logout invalidates refresh token
- **Suspended account** check — 403 with reason message
- **Maintenance mode** check — 503 blocks login for OWNER/MANAGER (DEVELOPER/SUPER_ADMIN bypass)
- Last login timestamp shown in topbar

### Topbar (post-login header)
- Role badge
- Hotel name for HOTEL_MANAGER (from `assignedPropertyName`)
- Hotels count for PROPERTY_OWNER (from `hotelCount`)
- NotificationBell with live unread count
- Last login timestamp

### Booking Inflow (Staff)
- Create manual (walk-in) bookings
- **CRM**: phone lookup — returning guest detection, auto-fill, past stays
- **Real-time overbooking warning** against confirmed bookings
- **ONLINE badge** on web bookings (`source === 'ONLINE'`)
- Shows "Rooms" (not "Guests") for online bookings
- **QR ID Upload**: one-time QR → guest scans on phone → uploads ID → staff auto-detects (3s polling)

### Inventory & Room Management
- Room grid with category filter
- Live occupancy status per room
- **Booking Queue** — 3 tabs: Active / Upcoming / History
- **Room Assignment Modal** — multi-room, guest distribution, compatibility
- **Check-In Modal** — financial summary, ID proof (view/generate QR)
- **Check-Out Modal** — settle balance, final payment
- Cancel booking

### Booking Calendar
- Month view grid (7×6)
- Per-day indicators: arrivals / departures / staying
- Click date → detail panel (Arrivals / Staying / Departures)
- Search by guest name or phone
- Property selector for SUPER_ADMIN / PROPERTY_OWNER

### Analytics & Summary
- Date + property filter
- Occupancy metrics + Online Bookings count
- Revenue breakdown (UPI / Cash / Card / Cashfree)
- Financial ledger with balance due / settled status
- **Export to Excel** (FTD XL format)
- **Export to PDF** (landscape, styled table)

### Property Owner Dashboard
- Create hotel + auto-provision manager in one form
- Edit hotel details + reset manager credentials
- **Hotel photo upload** (up to 5 per hotel → Cloudflare R2)
- Subscription limit badge

### Admin Dashboard (Super Admin)
- **Create / Edit** property owner accounts (name, email, maxHotels, password)
- **Suspend / Unsuspend** owners with reason (immediate logout via refresh token wipe)
- **Delete** owner accounts
- **Create / Edit / Suspend / Delete** developer accounts
- Full list of owners (with hotel count) and developers (with last login)

### Checkout Beep Alert (Hotel Manager)
- Polls `/api/support/checkout-alerts` every 5 minutes (manager only)
- **Web Audio API triple-beep** (880 Hz → 660 Hz → 880 Hz) using `AudioContext` — zero dependencies
- **Snooze 30 minutes** button
- **Orange pulsing banner** listing guests checking out today
- Only fires for the logged-in manager's own hotel

### In-App Notification System
- **Bell icon** in topbar with animated pulsing + red unread badge
- **Compose panel** (for SUPER_ADMIN, PROPERTY_OWNER, DEVELOPER):
  - Template presets per role (PAY_BILL, CONGRATS, WARNING, TASK_ASSIGN, MAINTENANCE, etc.)
  - Target: broadcast to role / specific user / hotel (owner → sends to that hotel's manager)
  - Priority: NORMAL / IMPORTANT / URGENT
  - Animation: SLIDE / BOUNCE / CONFETTI / SHAKE / GLOW
  - **Scheduled send**: pick a future datetime — notification appears only after that time
  - **Repeat config**: gap hours between resends, max per day, repeat-until date
- **Live inbox**: polls every 15 seconds for near-real-time delivery
- **URGENT notifications**: full-screen modal overlay with red header + Acknowledge button
- **IMPORTANT/NORMAL**: animated toast at top-right (auto-dismisses 6s)
- **Auto-show on load**: any unread notification shows immediately when dashboard opens (no bell click needed)
- **Read = Clear**: clicking a notification marks it read AND removes it from inbox permanently (no re-showing)
- **Mark All Read**: clears entire inbox in one click
- Notifications auto-expire after 7 days via MongoDB TTL index
- Notifications with `scheduledFor` in the future are hidden until that time

### Support Ticket System
- **Floating `?` widget** (bottom-right corner) on all staff pages
- Raise tickets: subject, description, category (Bug / Technical / Feature / Billing / Other), priority
- Open ticket count badge on widget button
- **Reply thread**: conversation view with dev replies highlighted in blue/violet
- **Resolution note** displayed with green styling when resolved
- **Developer portal**: full ticket management tab
  - Filter by status / priority / category
  - Stat row (Total / Open / In Progress / Resolved)
  - Inline expand row: full description, status update dropdown, resolution note, reply thread, reply box
  - Updating status to RESOLVED auto-sets `resolvedAt`
  - First developer reply auto-moves ticket from OPEN → IN_PROGRESS
- **Auto-hide for reporter**: once a reporter views a RESOLVED/CLOSED ticket, it disappears from their list 15 hours later (`reporterViewedAt` + 15h filter on `GET /tickets/mine`)
- **Developer view**: all tickets retained permanently

### Developer Console (`/developer`)
- **Overview tab**: 24h stats — total requests, errors, warnings, avg/max response time, top routes, device breakdown, HTTP status codes, top IPs, hourly timeline chart
- **Logs tab**: paginated request logs — filter by type/method/route/status code; expandable rows with full detail + stack trace; manual purge
- **Errors tab**: error heatmap by route, error list + warning list (expandable detail)
- **Database tab**:
  - **Storage health bar** (green/yellow/red based on `DB_STORAGE_LIMIT_MB` env var, default 512 MB)
  - Warning at 80%, danger at 95%
  - Collection stats (documents, data size, storage, indexes, avg doc size)
- **System tab**:
  - Node.js process info (version, platform, PID, uptime)
  - MongoDB connection status
  - OS info (type, CPUs, memory)
  - **Rate Limit Manager** — config viewer, manual IP reset, throttled IPs list with one-click unblock
  - **Maintenance Mode card** (see below)
- **Hotels tab**: all properties with owner + manager info; suspend/reactivate hotel; remove manager
- **Users tab**: all staff (excluding SUPER_ADMIN); suspend/reactivate; force logout (clears refresh token); password reset
- **Cleanup tab**: expired upload tokens + old logs stats; one-click purge buttons
- **Support tab**: all tickets from all reporters; filter by status/priority/category; inline expand with update + reply

### Maintenance Mode
- **Developer-only toggle** in the System tab of Developer Console
- **Immediate ON/OFF** toggle switch
- **Custom message** shown to users on maintenance screen + login page
- **Scheduled mode**: set start datetime + end datetime — activates and deactivates automatically
- When active:
  - All PROPERTY_OWNER and HOTEL_MANAGER staff see a full-screen maintenance overlay (animated wrench spinner, message, expected-back time)
  - Login returns **HTTP 503** with maintenance message for those roles
  - DEVELOPER and SUPER_ADMIN can still log in and work normally
  - Login page shows a yellow maintenance banner with the message + expected-back time
- Status indicator on the card: 🔴 ACTIVE / ⏰ Scheduled / ✅ Inactive
- Public endpoint `GET /api/maintenance-status` (no auth) polled every 60s by the frontend

### ID Proof Upload Page (`/upload-id/:token`)
- Phone-optimized, no login required
- Camera capture for direct photo on mobile
- Accepts JPEG, PNG, WebP, PDF (max 10 MB)
- Uploads to Cloudflare R2 via one-time token
- States: idle → uploading → success / expired / error

---

## API Reference

### Authentication — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/login` | None | Login — checks suspension, maintenance (503 for non-dev if active), returns token + user |
| POST | `/refresh` | None | Exchange refresh token for new access token |
| POST | `/logout` | None | Invalidates refresh token in DB |

### Admin — `/api/admin`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/create-owner` | SUPER_ADMIN | Create property owner with subscription limit |
| GET | `/owners` | SUPER_ADMIN | List all property owners |
| PATCH | `/owners/:id` | SUPER_ADMIN | Edit owner (name, email, maxHotels, password) |
| PATCH | `/owners/:id/suspend` | SUPER_ADMIN | Toggle suspend + reason (clears refresh token) |
| DELETE | `/owners/:id` | SUPER_ADMIN | Delete owner account |
| POST | `/create-developer` | SUPER_ADMIN | Create developer account |
| GET | `/developers` | SUPER_ADMIN | List all developer accounts |
| PATCH | `/developers/:id` | SUPER_ADMIN | Edit developer (name, email, password) |
| PATCH | `/developers/:id/suspend` | SUPER_ADMIN | Suspend/unsuspend developer |
| DELETE | `/developers/:id` | SUPER_ADMIN | Delete developer account |
| GET | `/setup` | None | One-time super admin seed (404 in production) |

### Properties & Rooms — `/api/properties`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/create` | PROPERTY_OWNER | Create hotel + auto-provision manager |
| PUT | `/:propertyId` | PROPERTY_OWNER | Update hotel details + manager credentials |
| GET | `/my-hotels` | PROPERTY_OWNER | List owned hotels |
| GET | `/` | SUPER_ADMIN | All properties globally |
| POST | `/:propertyId/rooms` | PROPERTY_OWNER | Add a room |
| GET | `/:propertyId/rooms` | Any authenticated | List rooms (RBAC enforced) |
| POST | `/:propertyId/photos` | PROPERTY_OWNER | Upload photos → R2 |
| DELETE | `/:propertyId/photos` | PROPERTY_OWNER | Remove photo from R2 + DB |

### Bookings — `/api/bookings`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/create` | Any authenticated | Create walk-in booking |
| GET | `/property/:propertyId` | Any authenticated | All bookings (RBAC enforced) |
| GET | `/property/:propertyId/pending` | Any authenticated | Pending assignment bookings |
| PUT | `/:id/assign` | Any authenticated | Assign rooms (MongoDB transaction) |
| PUT | `/:id/status` | Any authenticated | Update status + log payment |
| GET | `/all` | Any authenticated | God view with filters |
| GET | `/guest/:phone` | Any authenticated | CRM — guest history |

### Public Guest Portal — `/api/public`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/hotels` | None | List active hotels |
| GET | `/hotels/:id` | None | Hotel detail + room categories |
| GET | `/hotels/:id/availability` | None | Per-category availability for dates |
| POST | `/bookings` | None | Create guest booking |
| POST | `/payments/order` | None | Create Cashfree payment order |
| POST | `/payments/verify` | None | Verify payment, mark booking PAID |
| GET | `/bookings/:id` | None | Track booking (public-safe fields) |
| POST | `/upload-token` | None | Generate one-time QR upload token |
| POST | `/upload-id/:token` | None | Upload ID proof via QR → R2 |
| GET | `/upload-status/:token` | None | Poll upload completion |

### Notifications — `/api/notifications`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/send` | SUPER_ADMIN / PROPERTY_OWNER / DEVELOPER | Send notification (with optional `scheduledFor` + `repeat`) |
| GET | `/inbox` | Any authenticated | Get inbox (excludes cleared, respects scheduledFor) |
| POST | `/:id/read` | Any authenticated | Mark read + clear from inbox permanently |
| POST | `/read-all` | Any authenticated | Clear entire inbox |
| GET | `/targets` | Any authenticated | Users/properties the sender can target |

### Support — `/api/support`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/tickets` | Any authenticated | Raise support ticket |
| GET | `/tickets/mine` | Any authenticated | Reporter's own tickets (hides resolved after 15h view) |
| GET | `/tickets` | DEVELOPER / SUPER_ADMIN | All tickets with filters |
| GET | `/tickets/:id` | Reporter or Dev/Admin | Single ticket (sets `reporterViewedAt` if resolved) |
| PATCH | `/tickets/:id` | DEVELOPER / SUPER_ADMIN | Update status + resolution note |
| POST | `/tickets/:id/reply` | Reporter or Dev/Admin | Add reply (first dev reply → IN_PROGRESS) |
| GET | `/checkout-alerts` | HOTEL_MANAGER | Bookings checking out today for this manager's hotel |

### Developer Console — `/api/developer`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/logs` | DEVELOPER | Paginated logs with filters |
| DELETE | `/logs/purge` | DEVELOPER | Manual log purge by age |
| GET | `/errors` | DEVELOPER | Error + warning summary |
| GET | `/stats/db` | DEVELOPER | MongoDB collection stats |
| GET | `/stats/db-health` | DEVELOPER | Storage % vs `DB_STORAGE_LIMIT_MB` |
| GET | `/stats/system` | DEVELOPER | Node.js + OS system info |
| GET | `/stats/api` | DEVELOPER | API usage analytics |
| GET | `/stats/ratelimits` | DEVELOPER | Rate limit config + throttled IPs |
| POST | `/rate-limits/reset` | DEVELOPER | Unblock an IP |
| GET | `/users` | DEVELOPER | All staff users (excluding SUPER_ADMIN) |
| PATCH | `/users/:id/suspend` | DEVELOPER | Suspend/unsuspend user |
| DELETE | `/users/:id/session` | DEVELOPER | Force logout (clears refresh token) |
| PATCH | `/users/:id/reset-password` | DEVELOPER | Reset user password |
| GET | `/hotels` | DEVELOPER | All hotels with owner + manager info |
| PATCH | `/hotels/:id/suspend` | DEVELOPER | Suspend/reactivate hotel |
| DELETE | `/hotels/:id/manager` | DEVELOPER | Unassign hotel manager |
| GET | `/cleanup/stats` | DEVELOPER | Expired tokens + old log counts |
| DELETE | `/cleanup/tokens` | DEVELOPER | Purge expired upload tokens |
| GET | `/maintenance` | DEVELOPER | Get current maintenance mode state |
| PATCH | `/maintenance` | DEVELOPER | Set maintenance mode (immediate or scheduled) |

### Public Maintenance — `/api/maintenance-status`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/maintenance-status` | None | Current maintenance state (polled every 60s by frontend) |

---

## Data Models

### User
```
name, email, password (bcrypt), role (SUPER_ADMIN|PROPERTY_OWNER|HOTEL_MANAGER|DEVELOPER),
assignedProperty (ref), createdBy (ref), maxHotelsAllowed, refreshToken (hashed),
suspended, suspendedReason, lastLogin
```

### Property
```
name, address, city, contactNumber, description, amenities[], photos[] (R2 URLs),
status (ACTIVE|INACTIVE|SUSPENDED), owner (ref)
```

### Room
```
property (ref), roomNumber, category (STANDARD_NON_AC|DELUXE_AC|PREMIUM_SUITE),
capacity, basePrice, currentStatus (AVAILABLE|OCCUPIED|MAINTENANCE)
```

### Booking
```
property (ref), bookedBy (ref), source (WALK_IN|ONLINE),
guestName, guestPhone, guestEmail, guestCount, documentUrl,
bookingType (FULL_DAY|HALF_DAY), reqType (AC|NON_AC),
checkIn, checkOut, status (PENDING_ASSIGNMENT|CONFIRMED|CHECKED_IN|CHECKED_OUT|CANCELLED),
assignedRooms [{ room (ref), guestsInRoom }],
totalAmount, advancePaid, paymentMethod, paymentStatus, cashfreeOrderId,
transactions [{ amount, method, date, type }]
```

### Notification
```
fromRole, fromUser (ref), toUser (ref), toRole, toProperty (ref),
title, message, template, priority (NORMAL|IMPORTANT|URGENT), animation,
readBy [userId], clearedBy [userId],
scheduledFor (Date — null = immediate),
repeat: { gapHours, perDay, tillDate },
expiresAt (TTL 7 days)
```

### SupportTicket
```
raisedBy (ref), property (ref), category, priority, subject, description,
status (OPEN|IN_PROGRESS|RESOLVED|CLOSED),
assignedTo (ref), resolutionNote, resolvedAt,
replies [{ fromUser, fromRole, message, createdAt }],
reporterViewedAt (Date — set on first view of resolved ticket; 15h filter in /mine)
```

### MaintenanceMode
```
isActive, message, scheduledStart, scheduledEnd, setBy (ref), activatedAt
```

### UploadToken
```
token (unique), status (PENDING|UPLOADED|EXPIRED), fileUrl, expiresAt (TTL 15 min)
```

### Log
```
method, route, statusCode, responseTime, userId (ref), ip, userAgent, createdAt (TTL 30d)
```

---

## Booking Status Flow

```
PENDING_ASSIGNMENT  →  CONFIRMED  →  CHECKED_IN  →  CHECKED_OUT
        ↓                  ↓              ↓
    CANCELLED          CANCELLED      CANCELLED
```

---

## Bug Fix Log

> All critical bugs resolved. UI/UX items remain as polish tasks.

### Critical — ✅ All Fixed

| # | File | Bug | Fix |
|---|---|---|---|
| 1 | `publicRoutes.js` | `reqType` regex matched `STANDARD_NON_AC` when searching `AC` | `$in` with exact categories from `CATEGORY_META` |
| 2 | `authMiddleware.js` | Expired tokens returned 400 instead of 401 | Returns 401 with `TokenExpiredError` distinction |
| 3 | `bookingRoutes.js` | Online booking room assignment failed (guestCount = rooms not people) | `source === 'ONLINE'` branches to room-count check |

### Security — ✅ All Fixed

| # | File | Bug | Fix |
|---|---|---|---|
| 4 | `adminRoutes.js` | `/setup` permanently exposed | Returns 404 in production |
| 5 | `bookingRoutes.js` | No ownership check on `GET /property/:id` | RBAC for PROPERTY_OWNER and HOTEL_MANAGER |

### Logic — ✅ All Fixed

| # | File | Bug | Fix |
|---|---|---|---|
| 6 | `requestLogger.js` | `req.user.userId` without optional chaining | Already used `req.user?.userId` — confirmed no change needed |
| 7 | `AdminDashboard.jsx` | `bkg.room.roomNumber` wrong shape | Iterates `bkg.assignedRooms[]` |
| 8 | `propertyRoutes.js` | `GET /:propertyId/rooms` no auth | RBAC added |

### Missing Handling — ✅ All Fixed

| # | File | Bug | Fix |
|---|---|---|---|
| 9 | `OwnerDashboard.jsx` | Photo error called `.json()` unconditionally | Checks `content-type` before parsing |
| 10 | `GuestPortal.jsx` | Stale availability data on 400 | Clears availability on non-OK response |

### UI/UX — Pending Polish

| # | Component | Issue |
|---|---|---|
| 11 | `BookingInflow.jsx` | Disabled "New Booking" button has no mobile hint |
| 12 | `GuestPortal.jsx` | Room count shows before dates selected |
| 13 | `Summary.jsx` | "Online Bookings" count is all-time, not date-scoped |

---

## Cloudflare R2 Setup

1. Cloudflare Dashboard → R2 → Create bucket
2. Create API token with `Object Read & Write`
3. Enable public access on bucket
4. Fill `backend/.env`:

```env
CF_R2_ACCOUNT_ID=your_account_id
CF_R2_ACCESS_KEY_ID=your_key_id
CF_R2_SECRET_ACCESS_KEY=your_secret
CF_R2_BUCKET_NAME=your_bucket
CF_R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev
```

Until configured: photo upload returns `"Cloudflare R2 is not configured"`.

---

## Cashfree Payment Setup

1. Set `CASHFREE_ENV=TEST` + test credentials for sandbox
2. Set `CASHFREE_ENV=PROD` + live credentials for production

Flow:
1. Guest confirms → `POST /api/public/payments/order`
2. Backend creates Cashfree order → returns `paymentSessionId`
3. Frontend opens Cashfree checkout modal
4. On return: URL has `?cf_order_id=...&booking_id=...`
5. Frontend calls `POST /api/public/payments/verify` → marks PAID

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Secret for signing access tokens |
| `PORT` | No | Server port (default: 5000) |
| `CASHFREE_APP_ID` | Yes (payments) | Cashfree App ID |
| `CASHFREE_SECRET_KEY` | Yes (payments) | Cashfree Secret Key |
| `CASHFREE_ENV` | No | `TEST` or `PROD` (default: TEST) |
| `FRONTEND_URL` | Yes (payments) | Frontend URL for Cashfree return URL |
| `CF_R2_ACCOUNT_ID` | Yes (photos) | Cloudflare Account ID |
| `CF_R2_ACCESS_KEY_ID` | Yes (photos) | R2 API Token Access Key ID |
| `CF_R2_SECRET_ACCESS_KEY` | Yes (photos) | R2 API Token Secret |
| `CF_R2_BUCKET_NAME` | Yes (photos) | R2 bucket name |
| `CF_R2_PUBLIC_URL` | Yes (photos) | R2 public bucket URL |
| `DB_STORAGE_LIMIT_MB` | No | Storage warning threshold in MB (default: 512) |

---

## MongoDB Transaction Note

Room assignment (`PUT /api/bookings/:id/assign`) uses a MongoDB session with `withTransaction()`. Requires a **replica set**. MongoDB Atlas enables this by default.

```bash
# Local single-node replica set
mongod --replSet rs0
# In mongo shell (first time):
rs.initiate()
```

---

## Deployment Notes

- **Frontend**: Vercel or Netlify. Set `VITE_API_URL` if backend URL changes.
- **Backend**: Railway, Render, or Fly.io. All env vars must be set in dashboard.
- **File uploads**: All photos + ID proofs → Cloudflare R2. No local disk dependency.
- **Rate limiting**: General limiter (300/15min) skips authenticated requests.
- **Disable setup endpoint**: `NODE_ENV=production` returns 404 on `/api/admin/setup`.
- **Logs**: MongoDB TTL auto-purges logs after 30 days. Manual cleanup available in Developer Console.
- **Maintenance mode**: Survives server restarts (stored in MongoDB). Only DEVELOPER/SUPER_ADMIN can bypass.

---

## Future Improvements

### High Priority
| Feature | Effort | Why |
|---|---|---|
| **Booking cancellation flow** | Medium | No cancel reason, partial refund, or room slot release yet |
| **GST Invoice PDF** | Low | jspdf installed. Generate tax invoice with GSTIN, HSN, 18% GST |
| **Confirmation email/SMS** | Medium | guestEmail + guestPhone already captured. Plug in Nodemailer/Twilio |
| **Notification repeat job** | Medium | Repeat config is stored — needs a cron/setInterval job in server.js to actually re-send |

### Medium Priority
| Feature | Effort | Why |
|---|---|---|
| **Dynamic / seasonal pricing** | Medium | Room basePrice exists — add price multiplier rules per date range |
| **Waiting list** | Medium | Fully booked → waitlist → notify on cancellation |
| **Housekeeping queue** | Medium | Post-checkout cleaning state before next check-in |
| **Multi-date Excel export** | Medium | Current export is single-day; add date-range grouping |
| **Two-factor auth** | Medium | TOTP for SUPER_ADMIN + PROPERTY_OWNER |

### Low Priority
| Feature | Effort | Description |
|---|---|---|
| **OTA webhook bridge** | High | Auto-create bookings from MakeMyTrip/Booking.com webhooks |
| **Room maintenance mode** | Low | `MAINTENANCE` status on rooms with expected-return date |
| **Bulk room import** | Low | CSV upload for mass room creation |
| **Multi-language portal** | High | i18n for guest portal (Hindi + regional languages) |
| **WebSocket push** | Medium | Replace 15s polling with real-time WebSocket notification delivery |
| **Booking.com channel sync** | Very High | Two-way calendar sync to prevent double-bookings |
