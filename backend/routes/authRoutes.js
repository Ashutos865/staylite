const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // Pulling in the real MongoDB model

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find the user in the live MongoDB database
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials. User not found.' });
    }

    // 2. Secure Password Check
    // We compare the plain text password from the frontend with the hashed password in the DB
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials. Incorrect password.' });
    }

    // 3. Generate the JWT (The VIP Badge)
    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      process.env.JWT_SECRET, // Pulling the secret from your .env file
      { expiresIn: '12h' }
    );

    // 4. Send token and user data back to React
    res.status(200).json({
      message: 'Login successful',
      token: token, 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        maxHotelsAllowed: user.maxHotelsAllowed,
        assignedProperty: user.assignedProperty // <-- THE CRITICAL FIX FOR MANAGERS
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;