const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

/**
 * Verifies the Bearer JWT, loads the user, and attaches it to req.user.
 * Rejects if the token is invalid/expired or the account has been deactivated.
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    throw ApiError.unauthorized('Not authenticated. Please provide a valid token.');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired token.');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw ApiError.unauthorized('User belonging to this token no longer exists.');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Your account has been deactivated. Contact support.');
  }

  req.user = user;
  next();
});

module.exports = { protect };
