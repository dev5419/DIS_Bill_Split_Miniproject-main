import mysql from 'mysql2/promise';

if (!global._mysqlPool) {
  global._mysqlPool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '4000'),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'splitease',
    waitForConnections: true,
    connectionLimit: 3,
    queueLimit: 0,
    timezone: '+00:00',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  });
}

const pool = global._mysqlPool;
export default pool;
