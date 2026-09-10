const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Like `protect`, but never rejects the request. Used on public product
 * listing endpoints so an authenticated admin can see inactive products
 * too, while anonymous/customer visitors get the default (active-only) view.
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user && user.isActive) {
      req.user = user;
    }
  } catch (err) {
    // Invalid/expired token on a public route - just proceed as anonymous.
  }

  next();
};

module.exports = optionalAuth;
