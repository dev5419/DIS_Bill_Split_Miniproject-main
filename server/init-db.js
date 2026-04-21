// Run this script once to initialize the TiDB Cloud database schema
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

async function initDB() {
  // Connect WITHOUT specifying database first (to create it)
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '4000'),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    multipleStatements: true,
  });

  console.log('✅ Connected to TiDB Cloud');

  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');

  console.log('⏳ Running schema...');
  await conn.query(schema);
  console.log('✅ Schema created successfully!');

  // Verify tables
  await conn.query('USE splitease');
  const [tables] = await conn.query('SHOW TABLES');
  console.log('\n📋 Tables created:');
  tables.forEach(t => console.log('   -', Object.values(t)[0]));

  await conn.end();
  console.log('\n🎉 Database initialization complete!');
}

initDB().catch(err => {
  console.error('❌ Failed to initialize database:', err.message);
  process.exit(1);
});
