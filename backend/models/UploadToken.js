const mongoose = require('mongoose');

const uploadTokenSchema = new mongoose.Schema({
  token:     { type: String, required: true, unique: true, index: true },
  status:    { type: String, enum: ['PENDING', 'UPLOADED', 'EXPIRED'], default: 'PENDING' },
  fileUrl:   { type: String, default: null },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });

module.exports = mongoose.model('UploadToken', uploadTokenSchema);
