const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['REQUEST', 'ERROR', 'WARNING', 'INFO'],
    required: true,
    index: true
  },

  // HTTP request details
  method: { type: String, uppercase: true },
  route: { type: String, index: true },
  statusCode: { type: Number, index: true },
  responseTime: { type: Number }, // milliseconds

  // Client identity
  ip: { type: String, index: true },
  device: { type: String }, // Desktop | Mobile | Tablet | Bot
  browser: { type: String },
  os: { type: String },
  userAgent: { type: String },

  // Auth context (nullable for unauthenticated requests)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  userRole: { type: String, default: null },

  // Message and error tracking
  message: { type: String },
  stack: { type: String },    // Stack trace for errors

  // Flexible metadata bucket for future fields
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  createdAt: { type: Date, default: Date.now, expires: '30d' }
}, {
  timestamps: false
});

// Compound indexes for common developer dashboard queries
logSchema.index({ type: 1, createdAt: -1 });
logSchema.index({ route: 1, method: 1, createdAt: -1 });
logSchema.index({ statusCode: 1, createdAt: -1 });

module.exports = mongoose.model('Log', logSchema);
