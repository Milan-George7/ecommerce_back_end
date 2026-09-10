const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');

const { errorHandler, notFound } = require('./middlewares/errorHandler');
const { apiLimiter } = require('./middlewares/rateLimiter');
const logger = require('./utils/logger');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();

// Security & parsing middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());

// Request logging - route morgan output through winston
app.use(
  morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// Global rate limiter (auth routes have their own stricter limiter)
app.use('/api', apiLimiter);

// Health check
app.get('/health', (req, res) => res.status(200).json({ success: true, message: 'OK' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

// 404 + centralized error handling (must be last)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
