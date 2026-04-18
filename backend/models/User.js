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
    enum: ['SUPER_ADMIN', 'PROPERTY_OWNER', 'HOTEL_MANAGER'],
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

  // The Hierarchy Tracker: 
  // - Admin ID goes here if they created an Owner.
  // - Owner ID goes here if they created a Manager.
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }

}, { 
  timestamps: true // Automatically adds createdAt and updatedAt dates
});

module.exports = mongoose.model('User', userSchema);