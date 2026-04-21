// Quick test to diagnose TiDB Cloud connection
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

console.log('Connection config:');
console.log('  Host:', process.env.MYSQL_HOST);
console.log('  Port:', process.env.MYSQL_PORT);
console.log('  User:', process.env.MYSQL_USER);
console.log('  Pass:', process.env.MYSQL_PASSWORD ? '***set***' : '***empty***');
console.log('  DB:  ', process.env.MYSQL_DATABASE);

async function test() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT || '4000'),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false,
      },
      connectTimeout: 15000,
    });
    console.log('✅ Connected to TiDB Cloud!');
    const [rows] = await conn.query('SELECT VERSION() AS version');
    console.log('   Version:', rows[0].version);
    await conn.end();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    console.error('   Code:', err.code);
  }
}

test();
