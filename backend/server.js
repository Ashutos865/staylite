require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Initialize Express App
const app = express();

// --- MIDDLEWARE ---
// Parses incoming JSON data from the frontend
app.use(express.json()); 
// Allows your React app (running on localhost:5173) to communicate with this server
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

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
app.use('/api/bookings', bookingRoutes); // Mounts at /api/bookings


// --- START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running smoothly on port ${PORT}`);
});