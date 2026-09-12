import dns from 'node:dns';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';

// Ensure Windows local DNS handles MongoDB Atlas SRV records smoothly
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
import { env } from './config/env.js';
import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { medicationRoutes } from './routes/medication.routes.js';
import { adherenceRoutes } from './routes/adherence.routes.js';
import { alertRoutes } from './routes/alert.routes.js';
import { emergencyRoutes } from './routes/emergency.routes.js';
import { voiceRoutes } from './routes/voice.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// ──────────────────────────────────────
// Middleware Stack
// ──────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ──────────────────────────────────────
// Health Check & Root
// ──────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name: 'Sarthak Telecare API',
    status: 'running',
    health: '/api/health',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    demoMode: env.DEMO_MODE,
  });
});

// ──────────────────────────────────────
// Database Readiness Guard (fail fast instead of 10s timeout)
// ──────────────────────────────────────
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      success: false,
      error: 'Connecting to MongoDB Atlas... Please ensure your current IP address (or 0.0.0.0/0) is added in MongoDB Atlas under Network Access.',
    });
    return;
  }
  next();
});

// ──────────────────────────────────────
// API Routes
// ──────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/adherence', adherenceRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/voice', voiceRoutes);

// ──────────────────────────────────────
// Error Handling
// ──────────────────────────────────────
app.use(errorHandler);

// ──────────────────────────────────────
// Database Connection & Server Start
// ──────────────────────────────────────
async function start() {
  // Start HTTP server immediately
  app.listen(env.PORT, () => {
    console.log(`\n🚀 Sarthak Server running on port ${env.PORT}`);
    console.log(`   Mode: ${env.NODE_ENV}`);
    console.log(`   Demo: ${env.DEMO_MODE ? 'ON' : 'OFF'}\n`);
  });

  // Auto-connecting database loop
  const connectDB = async () => {
    if (mongoose.connection.readyState === 1) return;
    try {
      console.log('🔌 Connecting to MongoDB Atlas...');
      await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 6000 });
      console.log('✅ MongoDB connected successfully to Atlas');
    } catch (err: any) {
      console.error('⚠️ MongoDB connection error:', err.message);
      console.error('💡 TIP: Add 0.0.0.0/0 to MongoDB Atlas "Network Access" to allow access from any IP.');
      setTimeout(connectDB, 8000);
    }
  };

  connectDB();
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mongoose.disconnect();
  process.exit(0);
});

start();

export default app;
