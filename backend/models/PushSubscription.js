const mongoose = require('mongoose');

const PushSubscriptionSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role:     { type: String },
  propertyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth:   { type: String, required: true },
  },
}, { timestamps: true });

module.exports = mongoose.model('PushSubscription', PushSubscriptionSchema);
