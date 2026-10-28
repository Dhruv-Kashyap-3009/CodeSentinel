import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDatabase(uri = config.mongoUri) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 });
  return mongoose.connection;
}
export function databaseReady() { return mongoose.connection.readyState === 1; }
export async function closeDatabase() { if (mongoose.connection.readyState !== 0) await mongoose.disconnect(); }
