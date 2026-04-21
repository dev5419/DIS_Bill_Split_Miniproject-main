import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import groupRoutes from './routes/groups.js';
import uploadRoutes from './routes/upload.js';
import { authenticate } from './middleware/auth.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', uploadRoutes);
app.use('/api/groups', authenticate, groupRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
