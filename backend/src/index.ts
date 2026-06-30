import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';

// Load env
dotenv.config();

// Imports
import { initSocket } from './config/socket';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import projectRoutes from './routes/projectRoutes';
import taskRoutes from './routes/taskRoutes';
import collaborationRoutes from './routes/collaborationRoutes';
import notificationRoutes from './routes/notificationRoutes';
import aiRoutes from './routes/aiRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import timeRoutes from './routes/timeRoutes';
import reportRoutes from './routes/reportRoutes';
import auditRoutes from './routes/auditRoutes';

const app = express();
const server = http.createServer(app);

// 1. Initialise WebSockets
initSocket(server);

// 2. Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow loading local uploads in frontend
}));

// CORS Configuration — allow Vercel deployments + localhost
const allowedOrigins = [
  /^https:\/\/.*\.vercel\.app$/,   // All Vercel preview & production URLs
  /^http:\/\/localhost(:\d+)?$/,   // Local development
  /^http:\/\/127\.0\.0\.1(:\d+)?$/ // Local development alt
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);
    const allowed = allowedOrigins.some((pattern) =>
      typeof pattern === 'string' ? pattern === origin : pattern.test(origin)
    );
    callback(null, allowed ? origin : false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
}));

// Express Json limit
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests, please try again later.' } },
});
app.use('/api/', limiter);

// 3. Static Uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 4. API Routes Mapping
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/collab', collaborationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/time-logs', timeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Exception:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unhandled server exception occurred',
    },
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(` WorkFlow Pro Backend running on port ${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=================================================`);
});
