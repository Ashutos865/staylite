const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['REQUEST', 'ERROR', 'WARNING', 'INFO'],
    required: true,
  },

  // HTTP request details
  method:       { type: String, uppercase: true },
  route:        { type: String },
  statusCode:   { type: Number },
  responseTime: { type: Number }, // milliseconds

  // Client identity
  ip:        { type: String },
  device:    { type: String }, // Desktop | Mobile | Tablet | Bot
  browser:   { type: String },
  os:        { type: String },
  userAgent: { type: String }, // only stored for ERROR / WARNING

  // Auth context (null for unauthenticated requests)
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userRole: { type: String, default: null },

  // Only populated for ERROR / WARNING / INFO — omitted from lean REQUEST docs
  message:  { type: String },
  stack:    { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed }, // no default → not stored unless set

  createdAt: { type: Date, default: Date.now, expires: '7d' } // 7d TTL (was 30d)
}, {
  timestamps: false
});

// ── Indexes ────────────────────────────────────────────────────────────────
// Rule: every query in developerRoutes.js has exactly one covering compound
// index. No standalone single-field indexes — they were duplicates that doubled
// index storage on the Atlas free tier.

logSchema.index({ type: 1,       createdAt: -1 }); // type filter + time sort
logSchema.index({ route: 1, method: 1, createdAt: -1 }); // route search
logSchema.index({ statusCode: 1, createdAt: -1 }); // status filter
logSchema.index({ userId: 1,     createdAt: -1 }); // per-user history
logSchema.index({ ip: 1,         createdAt: -1 }); // rate-limit / brute-force analysis

// createdAt TTL index is declared inline above via `expires: '7d'`

module.exports = mongoose.model('Log', logSchema);
