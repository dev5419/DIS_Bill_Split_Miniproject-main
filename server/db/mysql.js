import '../config.js';
import mysql from 'mysql2/promise';

const uri = process.env.TIDB_URI;

if (!global._mysqlPool) {
  if (uri) {
    global._mysqlPool = mysql.createPool(uri);
  } else {
    global._mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT || '4000'),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE || 'splitease',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
      }
    });
  }
}

const pool = global._mysqlPool;
export default pool;
