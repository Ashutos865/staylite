const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { resetIP } = require('../middleware/rateLimiters');

// ==========================================
// 1. CREATE PROPERTY OWNER (Super Admin Only)
// ==========================================
router.post('/create-owner', verifyToken, requireRole('SUPER_ADMIN'), [
  body('name').trim().notEmpty().withMessage('Owner name is required.'),
  body('email').isEmail().normalizeEmail().withMessage('A valid email address is required.'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  body('maxHotelsAllowed').optional().isInt({ min: 1 }).withMessage('Max hotels must be a positive integer.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const { name, email, password, maxHotelsAllowed } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create Owner
    const newOwner = new User({
      name,
      email,
      password: hashedPassword,
      role: 'PROPERTY_OWNER',
      maxHotelsAllowed: maxHotelsAllowed || 1 
    });

    await newOwner.save();

    res.status(201).json({
      message: 'Property Owner successfully created!',
      owner: {
        id: newOwner._id,
        name: newOwner.name,
        email: newOwner.email,
        maxHotelsAllowed: newOwner.maxHotelsAllowed
      }
    });

  } catch (error) {
    console.error('Error creating owner:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 1.5 GET ALL PROPERTY OWNERS (Admin Only)
// ==========================================
// GET /api/admin/owners
router.get('/owners', verifyToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    // Find all users with the role PROPERTY_OWNER. 
    // We use .select('-password') to ensure we NEVER send hashed passwords to the frontend!
    const owners = await User.find({ role: 'PROPERTY_OWNER' }).select('-password').sort({ createdAt: -1 });
    
    res.status(200).json(owners);
  } catch (error) {
    console.error('Error fetching owners:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 1b. UPDATE PROPERTY OWNER (Super Admin Only)
// ==========================================
// PATCH /api/admin/owners/:id
router.patch('/owners/:id', verifyToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, email, maxHotelsAllowed, password } = req.body;
    const owner = await User.findOne({ _id: req.params.id, role: 'PROPERTY_OWNER' });
    if (!owner) return res.status(404).json({ message: 'Owner not found.' });

    if (name) owner.name = name.trim();
    if (email) {
      const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: owner._id } });
      if (existing) return res.status(400).json({ message: 'Email already in use by another account.' });
      owner.email = email.toLowerCase().trim();
    }
    if (maxHotelsAllowed != null) owner.maxHotelsAllowed = Number(maxHotelsAllowed);
    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      owner.password = await bcrypt.hash(password, salt);
      owner.refreshToken = null; // force re-login after password change
    }

    await owner.save();
    res.json({ message: 'Owner updated successfully.', owner: { id: owner._id, name: owner.name, email: owner.email, maxHotelsAllowed: owner.maxHotelsAllowed } });
  } catch (error) {
    console.error('Update owner error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 1c. SUSPEND / UNSUSPEND OWNER (Super Admin Only)
// ==========================================
// PATCH /api/admin/owners/:id/suspend
router.patch('/owners/:id/suspend', verifyToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { suspended, reason } = req.body;
    const owner = await User.findOne({ _id: req.params.id, role: 'PROPERTY_OWNER' });
    if (!owner) return res.status(404).json({ message: 'Owner not found.' });

    owner.suspended = !!suspended;
    owner.suspendedReason = suspended ? (reason || 'Suspended by administrator.') : null;
    if (suspended) owner.refreshToken = null; // force immediate logout
    await owner.save();
    res.json({ message: `Owner account ${suspended ? 'suspended' : 'reactivated'} successfully.` });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 1d. DELETE PROPERTY OWNER (Super Admin Only)
// ==========================================
// DELETE /api/admin/owners/:id
router.delete('/owners/:id', verifyToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const owner = await User.findOne({ _id: req.params.id, role: 'PROPERTY_OWNER' });
    if (!owner) return res.status(404).json({ message: 'Owner not found.' });
    await owner.deleteOne();
    res.json({ message: 'Owner account deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 3b. UPDATE DEVELOPER ACCOUNT (Super Admin Only)
// ==========================================
// PATCH /api/admin/developers/:id
router.patch('/developers/:id', verifyToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, email, suspended, reason, password } = req.body;
    const dev = await User.findOne({ _id: req.params.id, role: 'DEVELOPER' });
    if (!dev) return res.status(404).json({ message: 'Developer not found.' });

    if (name) dev.name = name.trim();
    if (email) {
      const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: dev._id } });
      if (existing) return res.status(400).json({ message: 'Email already in use.' });
      dev.email = email.toLowerCase().trim();
    }
    if (password && password.length >= 8) {
      const salt = await bcrypt.genSalt(10);
      dev.password = await bcrypt.hash(password, salt);
      dev.refreshToken = null;
    }
    if (suspended != null) {
      dev.suspended = !!suspended;
      dev.suspendedReason = suspended ? (reason || 'Suspended by administrator.') : null;
      if (suspended) dev.refreshToken = null;
    }

    await dev.save();
    res.json({ message: 'Developer account updated.', developer: { id: dev._id, name: dev.name, email: dev.email, suspended: dev.suspended } });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 3c. DELETE DEVELOPER ACCOUNT (Super Admin Only)
// ==========================================
// DELETE /api/admin/developers/:id
router.delete('/developers/:id', verifyToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const dev = await User.findOne({ _id: req.params.id, role: 'DEVELOPER' });
    if (!dev) return res.status(404).json({ message: 'Developer not found.' });
    await dev.deleteOne();
    res.json({ message: 'Developer account deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 2. TEMPORARY SETUP SCRIPT (Run this ONCE)
// ==========================================
// GET /api/admin/setup  (disabled in production)
router.get('/setup', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'Not found.' });
  }
  try {
    // Check if an admin already exists to prevent duplicates
    const adminExists = await User.findOne({ role: 'SUPER_ADMIN' });
    if (adminExists) {
      return res.status(400).json({ message: 'Super Admin already exists. Setup disabled.' });
    }

    // Create your master account
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt); // Default password: admin123

    const superAdmin = new User({
      name: 'Ashutosh Patra', // Master Admin!
      email: 'admin@ties.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
    });

    await superAdmin.save();

    res.status(201).json({ 
      message: 'SUCCESS! Super Admin created.', 
      email: 'admin@ties.com',
      password: 'admin123' 
    });

  } catch (error) {
    res.status(500).json({ message: 'Setup Failed', error });
  }
});

// ==========================================
// 3. CREATE DEVELOPER ACCOUNT (Super Admin Only)
// ==========================================
// POST /api/admin/create-developer
router.post('/create-developer', verifyToken, requireRole('SUPER_ADMIN'), [
  body('name').trim().notEmpty().withMessage('Developer name is required.'),
  body('email').isEmail().normalizeEmail().withMessage('A valid email address is required.'),
  body('password').isLength({ min: 8 }).withMessage('Developer password must be at least 8 characters.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newDeveloper = new User({
      name,
      email,
      password: hashedPassword,
      role: 'DEVELOPER'
    });

    await newDeveloper.save();

    res.status(201).json({
      message: 'Developer account created successfully!',
      developer: { id: newDeveloper._id, name: newDeveloper.name, email: newDeveloper.email, role: 'DEVELOPER' }
    });

  } catch (error) {
    console.error('Error creating developer:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 4. LIST DEVELOPER ACCOUNTS (Super Admin Only)
// ==========================================
// GET /api/admin/developers
router.get('/developers', verifyToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const developers = await User.find({ role: 'DEVELOPER' }).select('-password -refreshToken').sort({ createdAt: -1 });
    res.status(200).json(developers);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 5. RESET RATE LIMIT FOR AN IP (Super Admin — lockout fallback)
// ==========================================
// POST /api/admin/rate-limits/reset
// Use this when a developer (or any user) is locked out and cannot log in
router.post('/rate-limits/reset', verifyToken, requireRole('SUPER_ADMIN'), (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ message: 'IP address is required.' });
  resetIP(ip);
  res.json({ message: `Rate limit cleared for ${ip}. They can now log in immediately.` });
});

module.exports = router;