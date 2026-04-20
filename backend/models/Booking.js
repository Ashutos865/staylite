const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },

  // null for guest (online) bookings; populated for bookings created by staff
  bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null },

  // --- MULTI-ROOM ASSIGNMENT ENGINE ---
  assignedRooms: [{
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    guestsInRoom: { type: Number, required: true, min: 1 }
  }],

  // --- GUEST DATA ---
  guestName:  { type: String, required: true },
  guestPhone: { type: String, required: true },
  guestEmail: { type: String, default: '' },
  guestCount: { type: Number, required: true, default: 1, min: 1 },
  documentUrl:{ type: String, default: 'pending_upload' },

  // --- BOOKING ENGINE ---
  source:      { type: String, enum: ['WALK_IN', 'ONLINE'], default: 'WALK_IN' },
  bookingType: { type: String, enum: ['FULL_DAY', 'HALF_DAY'], required: true },
  reqType:     { type: String, enum: ['AC', 'NON_AC'], required: true },

  checkIn:  { type: Date, required: true },
  checkOut: { type: Date, required: true },

  // --- FINANCIALS & LEDGER ---
  totalAmount:   { type: Number, required: true },
  advancePaid:   { type: Number, default: 0 },
  paymentMethod: { type: String, enum: ['CASH', 'UPI', 'CARD', 'CASHFREE'], required: true },

  // Online payment tracking
  paymentStatus:    { type: String, enum: ['PENDING', 'PAID', 'FAILED'], default: 'PENDING' },
  cashfreeOrderId:  { type: String, default: null },
  cashfreePaymentId:{ type: String, default: null },

  transactions: [{
    amount: { type: Number, required: true },
    method: { type: String, enum: ['CASH', 'UPI', 'CARD', 'CASHFREE'], required: true },
    date:   { type: Date, default: Date.now },
    type:   { type: String, enum: ['ADVANCE', 'CHECK_IN', 'CHECK_OUT', 'PAYMENT'] }
  }],

  status: {
    type: String,
    enum: ['PENDING_ASSIGNMENT', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'],
    default: 'PENDING_ASSIGNMENT'
  }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
