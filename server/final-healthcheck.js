import './config.js';
import pool from './db/mysql.js';
import client, { connectMongoDB } from './db/mongodb.js';

async function testConnections() {
    console.log('🔄 Initiating final health check for both databases...');
    let tidbSuccess = false;
    let mongoSuccess = false;

    // 1. Check TiDB (MySQL)
    try {
        console.log('\n📡 Testing TiDB (MySQL) Connection...');
        console.log(`   Host: ${process.env.MYSQL_HOST}`);
        const [rows] = await pool.query('SELECT 1 as result');
        if (rows[0].result === 1) {
            console.log('   ✅ TiDB Connection is INTACT & RESPONSIVE!');
            tidbSuccess = true;
        }
    } catch (error) {
        console.error('   ❌ TiDB Connection FAILED:', error.message);
    }

    // 2. Check MongoDB Atlas
    try {
        console.log('\n📡 Testing MongoDB Atlas Connection...');
        const mongoDb = await connectMongoDB();
        const pingResult = await mongoDb.command({ ping: 1 });
        if (pingResult.ok === 1) {
            console.log('   ✅ MongoDB Connection is INTACT & RESPONSIVE!');
            mongoSuccess = true;
        }
    } catch (error) {
        console.error('   ❌ MongoDB Connection FAILED:', error.message);
    } finally {
        // Close MongoDB client to allow script to exit
        await client.close();
    }

    // Close TiDB pool
    await pool.end();

    console.log('\n=============================================');
    if (tidbSuccess && mongoSuccess) {
        console.log('🎉 VERDICT: BOTH DATABASES ARE 100% INTACT AND READY!');
    } else {
        console.log('⚠️ VERDICT: ONE OR MORE ISSUES DETECTED.');
    }
    console.log('=============================================\n');
}

testConnections();
