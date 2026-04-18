const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  // Which hotel does this room belong to?
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true 
  },
  roomNumber: { 
    type: String, 
    required: true 
  },
  category: {
    type: String,
    enum: ['STANDARD_NON_AC', 'DELUXE_AC', 'PREMIUM_SUITE'],
    required: true
  },
  capacity: { 
    type: Number, 
    required: true 
  },
  basePrice: { 
    type: Number, 
    required: true 
  },
  // Live status for the Inventory Dashboard
  currentStatus: {
    type: String,
    enum: ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'],
    default: 'AVAILABLE'
  }
}, { timestamps: true });

// CRITICAL SAAS LOGIC: 
// A Property Owner can have a "Room 101" in Hotel A, and a "Room 101" in Hotel B.
// This index ensures room numbers are only unique WITHIN a specific hotel, not the whole database.
roomSchema.index({ property: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);