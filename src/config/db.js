const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI is not defined in environment variables');
  }

  mongoose.set('strictQuery', true);

  const conn = await mongoose.connect(uri, {
    autoIndex: process.env.NODE_ENV !== 'production',
  });

  logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB connection error: ${err.message}`);
  });

  return conn;
};

module.exports = connectDB;
