const jwt = require('jsonwebtoken');

// 1. Check if the user has a valid Token (Are they logged in?)
const verifyToken = (req, res, next) => {
  // Get token from the header
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ message: 'Access Denied. No token provided.' });
  }

  try {
    // Remove "Bearer " if it's included in the string
    const actualToken = token.startsWith('Bearer ') ? token.slice(7, token.length) : token;
    
    // Verify the token using your secret key
    const verified = jwt.verify(actualToken, process.env.JWT_SECRET);
    
    // Attach the decoded user payload (id, role) to the request so the next function can use it
    req.user = verified; 
    next(); // Pass control to the next function
  } catch (error) {
    res.status(400).json({ message: 'Invalid Token.' });
  }
};

// 2. Check if the user has the correct Role (Are they an Admin?)
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    // req.user was set by verifyToken right above this!
    if (!req.user || req.user.role !== requiredRole) {
      return res.status(403).json({ 
        message: `Forbidden. This action requires ${requiredRole} privileges.` 
      });
    }
    next();
  };
};

module.exports = { verifyToken, requireRole };