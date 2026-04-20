const mongoose = require('mongoose');

const maintenanceModeSchema = new mongoose.Schema({
  isActive:       { type: Boolean, default: false },
  message:        { type: String, default: 'System is currently under scheduled maintenance. Please try again later.' },
  scheduledStart: { type: Date, default: null },
  scheduledEnd:   { type: Date, default: null },
  setBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  activatedAt:    { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('MaintenanceMode', maintenanceModeSchema);
