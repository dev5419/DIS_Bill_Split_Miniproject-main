import '../config.js';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!global._mongoClientPromise) {
  const client = new MongoClient(uri, { maxPoolSize: 10 });
  global._mongoClientPromise = client.connect();
}

export async function connectMongoDB() {
  const client = await global._mongoClientPromise;
  console.log('✅ Connected to MongoDB');
  return client.db();
}

export async function getDB() {
  const client = await global._mongoClientPromise;
  return client.db();
}

// We can still export a default for compatibility if needed.
const client = await global._mongoClientPromise.catch(() => null);
export default client;
