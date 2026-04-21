import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!global._mongoClientPromise) {
  const client = new MongoClient(uri, { maxPoolSize: 3 });
  global._mongoClientPromise = client.connect();
}

export async function getDB() {
  const client = await global._mongoClientPromise;
  return client.db();
}
