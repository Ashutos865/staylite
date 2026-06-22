const mongoose = require('mongoose');

const AppConfigSchema = new mongoose.Schema({
  appName:   { type: String, default: 'StayLite' },
  iconUrl:   { type: String, default: '' },
  updatedBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('AppConfig', AppConfigSchema);
