import '../config.js';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/billsplit';
const client = new MongoClient(uri);

let db = null;

export async function connectMongoDB() {
  await client.connect();
  // Uses the database specified in the connection string, fallback to 'billsplit'
  db = client.db();
  console.log('✅ Connected to MongoDB');
  return db;
}

export function getDB() {
  if (!db) throw new Error('MongoDB not connected. Call connectMongoDB() first.');
  return db;
}

export default client;
