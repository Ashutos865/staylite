require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const { generalLimiter, authLimiter } = require('./middleware/rateLimiters');
const { requestLogger } = require('./middleware/requestLogger');

// Initialize Express App
const app = express();

// --- MIDDLEWARE ---
app.use(express.json());
// Photos are stored on Cloudflare R2 — no local static serving needed
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

// --- RATE LIMITING ---
app.use(generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/refresh', authLimiter);

// --- REQUEST LOGGER (captures every API call into MongoDB) ---
app.use(requestLogger);

// --- DATABASE CONNECTION ---
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env file");
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected Successfully to Hotel SaaS DB');
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error.message);
    process.exit(1); // Stop the server if the database fails
  }
};
connectDB();

// --- API ROUTES ---
// 1. Base Health Check Route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Hotel SaaS API Engine' });
});

// Public maintenance status — polled by frontend every 60s (no auth required)
app.get('/api/maintenance-status', async (req, res) => {
  try {
    const MaintenanceMode = require('./models/MaintenanceMode');
    const m = await MaintenanceMode.findOne().sort({ updatedAt: -1 });
    if (!m) return res.json({ isActive: false, message: '' });
    const now = new Date();
    const scheduledActive = m.scheduledStart && m.scheduledStart <= now && (!m.scheduledEnd || m.scheduledEnd > now);
    const pastEnd = m.scheduledEnd && m.scheduledEnd <= now;
    if (pastEnd && !m.isActive) return res.json({ isActive: false, message: '' });
    res.json({
      isActive: m.isActive || scheduledActive,
      message:  m.message,
      scheduledStart: m.scheduledStart,
      scheduledEnd:   m.scheduledEnd
    });
  } catch { res.json({ isActive: false, message: '' }); }
});

// 2. Authentication Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes); // Mounts at /api/auth

// 3. Admin Routes 
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes); // Mounts at /api/admin

// 4. Property & Room Routes (NEW)
const propertyRoutes = require('./routes/propertyRoutes');
app.use('/api/properties', propertyRoutes); // Mounts at /api/properties

// 5. Booking Engine Routes
const bookingRoutes = require('./routes/bookingRoutes');
app.use('/api/bookings', bookingRoutes);

// 6. Developer Observability Routes
const developerRoutes = require('./routes/developerRoutes');
app.use('/api/developer', developerRoutes);

// 7. Public Guest Booking Portal (no auth required)
const publicRoutes = require('./routes/publicRoutes');
app.use('/api/public', publicRoutes);

// 8. Internal Notification System
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);

// 9. Support Ticket System
const supportRoutes = require('./routes/supportRoutes');
app.use('/api/support', supportRoutes);


// --- START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running smoothly on port ${PORT}`);
});