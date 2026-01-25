import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import coursesRoutes from './routes/courses.js';
import sessionsRoutes from './routes/sessions.js';
import attendanceRoutes from './routes/attendance.js';
import assignmentsRoutes from './routes/assignments.js';
import submissionsRoutes from './routes/submissions.js';
import reviewsRoutes from './routes/reviews.js';
import assignmentResourcesRoutes from './routes/assignment-resources.js';
import quizzesRoutes from './routes/quizzes.js';
import examsRoutes from './routes/exams.js';
import profileRoutes from './routes/profile.js';
import suggestionsRoutes from './routes/suggestions.js';
import adminRoutes from './routes/admin.js';
import prisma from './config/database.js';
import { seedDefaultSuggestions } from './utils/seedDefaults.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware - configure helmet to allow images
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "http://localhost:5000", "http://localhost:5173"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);
// CORS configuration - supports multiple origins in production
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
      : ['http://localhost:5173'];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is allowed
    if (allowedOrigins.some(allowed => origin === allowed || origin.includes(allowed))) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin, 'Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization', 'Content-Disposition', 'Content-Type', 'Content-Length'],
};

app.use(cors(corsOptions));

// Rate limiting - General API limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs (increased to handle quiz questions)
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/health' || req.path === '/health/db',
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Text-only assignments - no file uploads needed
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// CORS helper function for file serving (backward compatibility)
const getCorsOrigin = (req) => {
  const requestOrigin = req.headers.origin;
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  // In production, check if request origin matches allowed origin
  if (requestOrigin && (requestOrigin === allowedOrigin || requestOrigin.includes(allowedOrigin))) {
    return requestOrigin;
  }
  
  // Fallback to allowed origin
  return allowedOrigin;
};

// Serve old local files if they exist (backward compatibility)
app.use('/api/v1/uploads', (req, res, next) => {
  // Set CORS headers for static files dynamically
  const origin = getCorsOrigin(req);
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
}, express.static(uploadDir, {
  setHeaders: (res, filePath) => {
    // Set proper content type for images
    if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (filePath.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
    // Ensure CORS headers are set for all file types
    const origin = getCorsOrigin({ headers: res.req?.headers || {} });
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  },
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database health check (check if quiz tables exist)
app.get('/health/db', async (req, res) => {
  try {
    // Try to query the Quiz table
    await prisma.$queryRaw`SELECT 1 FROM "Quiz" LIMIT 1`;
    res.json({ 
      status: 'ok', 
      message: 'Quiz tables exist',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    if (error.code === 'P2021' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
      res.status(503).json({ 
        status: 'error',
        message: 'Quiz tables do not exist. Migration required.',
        error: 'Run: cd backend && npx prisma migrate dev --name add_quizzes',
        timestamp: new Date().toISOString() 
      });
    } else {
      res.status(500).json({ 
        status: 'error',
        message: 'Database check failed',
        error: error.message,
        timestamp: new Date().toISOString() 
      });
    }
  }
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/courses', coursesRoutes);
app.use('/api/v1/sessions', sessionsRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/assignments', assignmentsRoutes);
app.use('/api/v1/submissions', submissionsRoutes);
app.use('/api/v1/reviews', reviewsRoutes);
app.use('/api/v1/assignment-resources', assignmentResourcesRoutes);
app.use('/api/v1', quizzesRoutes);
app.use('/api/v1', examsRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/suggestions', suggestionsRoutes);
app.use('/api/v1/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Seed default suggestions on startup (non-blocking)
seedDefaultSuggestions().catch((error) => {
  console.error('Failed to seed default suggestions:', error);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});
