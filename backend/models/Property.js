const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  name:          { type: String, required: true },
  address:       { type: String, required: true },
  city:          { type: String, default: '' },
  contactNumber: { type: String },
  description:   { type: String, default: '' },
  amenities:     [{ type: String }],   // e.g. ['WiFi', 'Parking', 'Restaurant', 'Pool']
  photos:        [{ type: String }],   // Uploaded photo URLs served from /uploads/properties/

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
    default: 'ACTIVE'
  }
}, { timestamps: true });

module.exports = mongoose.model('Property', propertySchema);
