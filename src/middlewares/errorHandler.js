const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * Converts known error types (Mongoose, JWT, etc.) into ApiError so the
 * final handler always deals with a consistent shape.
 */
const normalizeError = (err) => {
  if (err instanceof ApiError) return err;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => e.message);
    return ApiError.badRequest('Validation failed', details);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {}).join(', ');
    return ApiError.conflict(`Duplicate value for field(s): ${field}`);
  }

  // Mongoose invalid ObjectId / cast error
  if (err.name === 'CastError') {
    return ApiError.badRequest(`Invalid value for field '${err.path}': ${err.value}`);
  }

  // JWT errors (defensive - auth middleware already handles most cases)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Invalid or expired token.');
  }

  return ApiError.internal(err.message || 'Something went wrong');
};

// 404 handler for unmatched routes
const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

// Final error handler - must be registered last
const errorHandler = (err, req, res, next) => {
  const apiError = normalizeError(err);

  if (!apiError.isOperational || apiError.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${err.stack || err.message}`);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${apiError.statusCode} ${apiError.message}`);
  }

  const response = {
    success: false,
    message: apiError.message,
  };

  if (apiError.details) {
    response.errors = apiError.details;
  }

  if (process.env.NODE_ENV === 'development' && !apiError.isOperational) {
    response.stack = err.stack;
  }

  res.status(apiError.statusCode || 500).json(response);
};

module.exports = { errorHandler, notFound };
