import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { getConfig } from './env.js';

/**
 * Connect to MongoDB database using Mongoose with production pooling and timeouts.
 * Connection credentials are kept confidential and never printed in logs.
 */
const connectDB = async () => {
  const config = getConfig();
  const uri = config.mongoUri;

  if (!uri) {
    const errorMsg = 'MongoDB connection error: MONGO_URI is not defined in environment variables.';
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  const mongooseOptions = {
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '10', 10),
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    family: 4 // Use IPv4 to avoid IPv6 resolution delays
  };

  try {
    const conn = await mongoose.connect(uri, mongooseOptions);
    logger.info(`MongoDB Connected successfully: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB runtime connection error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB connection lost. Reconnecting...');
    });

    return conn;
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error: error.message });
    throw error;
  }
};

export default connectDB;
