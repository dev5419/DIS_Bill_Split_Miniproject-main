import './config.js';
import express from 'express';
import cors from 'cors';
import { connectMongoDB } from './db/mongodb.js';
import pool from './db/mysql.js';
import authRoutes from './routes/auth.js';
import groupRoutes from './routes/groups.js';
import uploadRoutes from './routes/upload.js';
import { authenticate } from './middleware/auth.js';

const app = express();
const PORT = process.env.SERVER_PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Routes ───
// Auth routes (some are public, /me is protected internally)
app.use('/api/auth', authRoutes);

// Image upload & serving (upload is protected internally, serving is public)
app.use('/api', uploadRoutes);

// Group routes (all protected)
app.use('/api/groups', authenticate, groupRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Start server ───
async function start() {
  try {
    // Test MySQL connection
    const connection = await pool.getConnection();
    console.log('✅ Connected to MySQL');
    connection.release();

    // Connect to MongoDB
    await connectMongoDB();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
