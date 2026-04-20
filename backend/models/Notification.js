const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Who sent it and who receives it
  fromRole: { type: String, enum: ['SUPER_ADMIN', 'PROPERTY_OWNER', 'DEVELOPER'], required: true },
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Target: a specific user, or all users of a role, or all managers of a specific property
  toUser:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  toRole:     { type: String, enum: ['PROPERTY_OWNER', 'HOTEL_MANAGER', 'ALL_STAFF'], default: null },
  toProperty: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null }, // narrow to one hotel's manager

  title:   { type: String, required: true, maxlength: 100 },
  message: { type: String, required: true, maxlength: 500 },

  // Preset template used (or 'CUSTOM')
  template: {
    type: String,
    enum: ['CUSTOM', 'PAY_BILL', 'CONGRATS', 'WARNING', 'ACCOUNT_REVIEW', 'TASK_ASSIGN',
           'DAILY_BRIEFING', 'SHIFT_ALERT', 'WELL_DONE', 'MAINTENANCE', 'SYSTEM_UPDATE', 'RESOLVED'],
    default: 'CUSTOM'
  },

  priority:  { type: String, enum: ['NORMAL', 'IMPORTANT', 'URGENT'], default: 'NORMAL' },
  animation: { type: String, enum: ['SLIDE', 'BOUNCE', 'CONFETTI', 'SHAKE', 'GLOW'], default: 'SLIDE' },

  // Per-recipient read tracking
  readBy:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // When a recipient reads → removed from their inbox permanently
  clearedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Scheduled delivery: null = send immediately; future date = only show after that time
  scheduledFor: { type: Date, default: null },

  // Repeat configuration (backend processes these periodically)
  repeat: {
    gapHours: { type: Number, default: null },  // hours between re-sends
    perDay:   { type: Number, default: null },  // max sends per calendar day
    tillDate: { type: Date,   default: null }   // stop repeating after this date
  },

  // Auto-expire after 7 days
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), index: { expires: 0 } }

}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
