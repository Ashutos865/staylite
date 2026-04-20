const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  raisedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  property:  { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null },

  category: {
    type: String,
    enum: ['BUG_REPORT', 'FEATURE_REQUEST', 'TECHNICAL_ISSUE', 'BILLING', 'OTHER'],
    required: true
  },

  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },

  subject:     { type: String, required: true, maxlength: 150 },
  description: { type: String, required: true, maxlength: 2000 },

  status: {
    type: String,
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    default: 'OPEN'
  },

  // Developer fills these in
  assignedTo:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolutionNote: { type: String, default: null },
  resolvedAt:     { type: Date, default: null },

  // Reply thread (simple)
  replies: [{
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fromRole: String,
    message: { type: String, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now }
  }],

  // Set when reporter views a RESOLVED/CLOSED ticket — ticket auto-hides 15h later for reporter
  reporterViewedAt: { type: Date, default: null }

}, { timestamps: true });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
