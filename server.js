require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 5000;

let server;

const start = async () => {
  try {
    await connectDB();
    server = app.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
};

// Graceful shutdown & safety nets
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully.');
  if (server) server.close(() => process.exit(0));
});

start();

module.exports = app;
