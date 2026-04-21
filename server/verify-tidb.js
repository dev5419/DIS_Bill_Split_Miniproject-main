import './config.js';
import pool from './db/mysql.js';

async function verifyUsers() {
  try {
    console.log('Connecting to', process.env.MYSQL_HOST);
    const [rows] = await pool.query('SELECT * FROM users');
    console.log(`Found ${rows.length} users in TiDB:`);
    rows.forEach(user => {
      console.log(`- ${user.email} (ID: ${user.id})`);
    });
    process.exit(0);
  } catch (error) {
    console.error('Failed to view users:', error.message);
    process.exit(1);
  }
}

verifyUsers();
