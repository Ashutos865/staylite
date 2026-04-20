const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  password: { 
    type: String, 
    required: true 
  },
  
  // --- THE 3-LAYER ROLE SYSTEM ---
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'PROPERTY_OWNER', 'HOTEL_MANAGER', 'DEVELOPER'],
    required: true
  },

  // --- SAAS LIMITS (Only applies to Property Owners) ---
  maxHotelsAllowed: {
    type: Number,
    // If they are an owner, default to 1 hotel limit. Otherwise, null.
    default: function() {
      return this.role === 'PROPERTY_OWNER' ? 1 : null;
    }
  },

  // --- TENANT MAPPING ---
  // If this is a Hotel Manager, which specific hotel are they allowed to see?
  assignedProperty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    default: null
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Account suspension (set by admin/developer — prevents login without deleting data)
  suspended: {
    type: Boolean,
    default: false
  },

  suspendedReason: {
    type: String,
    default: null
  },

  lastLogin: { type: Date, default: null },

  // Stores hashed refresh token; null when logged out
  refreshToken: {
    type: String,
    default: null
  }

}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);