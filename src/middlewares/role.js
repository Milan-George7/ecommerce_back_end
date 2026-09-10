const ApiError = require('../utils/ApiError');

/**
 * Usage: authorize('admin') or authorize('admin', 'customer')
 * Must be used after `protect` so req.user is populated.
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Not authenticated.'));
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(
      ApiError.forbidden(`Role '${req.user.role}' is not permitted to perform this action.`)
    );
  }

  next();
};

module.exports = { authorize };
