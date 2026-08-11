// =====================================================================
// REEBOW TECH PLATFORM — COMPLETE SERVER.JS
// Final Boss Version — RENDER-FIXED v3 (Absolute Static Paths)
// =====================================================================

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import winston from 'winston';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

// -------------------------------------------------------------------
// PATHS
// -------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname);
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
const LOGS_DIR = join(PROJECT_ROOT, 'logs');
const CLIPS_DIR = join(PUBLIC_DIR, 'clips');

[LOGS_DIR, CLIPS_DIR].forEach((dir) => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
});

// -------------------------------------------------------------------
// ENV VALIDATION
// -------------------------------------------------------------------
const requiredEnv = ['MONGO_URI', 'SESSION_SECRET', 'SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_PASSWORD'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`❌ FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// -------------------------------------------------------------------
// LOGGER
// -------------------------------------------------------------------
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: join(LOGS_DIR, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: join(LOGS_DIR, 'combined.log') }),
  ],
});
const log = {
  info: (msg, meta) => logger.info(msg, meta),
  error: (msg, meta) => logger.error(msg, meta),
};

// -------------------------------------------------------------------
// DATABASE
// -------------------------------------------------------------------
mongoose.set('strictQuery', true);

async function connectMongo() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME || 'reebow-platform',
  });
  log.info('✅ MongoDB connected');
}

// -------------------------------------------------------------------
// MODELS
// -------------------------------------------------------------------
const tenantSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: 'Support Agent' },
    plan: { type: String, default: 'monthly' },
    status: { type: String, enum: ['active', 'suspended', 'cancelled'], default: 'active' },
    lastLoginAt: Date,
  },
  { timestamps: true, collection: 'tenants' }
);
const Tenant = mongoose.model('Tenant', tenantSchema);

const visitorSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    country: String,
    countryCode: String,
    city: String,
    region: String,
    timezone: String,
    isp: String,
    isMobile: Boolean,
    isProxy: Boolean,
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED', 'BANNED'], default: 'ACTIVE' },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    messages: [
      {
        sender: { type: String, enum: ['visitor', 'admin', 'system'] },
        content: String,
        messageType: { type: String, default: 'text' },
        timestamp: { type: Date, default: Date.now },
        read: { type: Boolean, default: false },
      },
    ],
    callLogs: [
      {
        type: { type: String, enum: ['incoming', 'outgoing', 'missed', 'rejected'] },
        status: { type: String, enum: ['connected', 'ended', 'failed', 'timeout'] },
        duration: { type: Number, default: 0 },
        persona: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, collection: 'visitors' }
);
visitorSchema.index({ tenantId: 1, email: 1 }, { unique: true });
const Visitor = mongoose.model('Visitor', visitorSchema);

// -------------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------------
function generateStrongPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) password += chars[bytes[i] % chars.length];
  return password;
}

async function createTenant(email, plan = 'monthly', name = 'Support Agent') {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await Tenant.findOne({ email: normalizedEmail });
  if (existing) throw new Error('Tenant already exists');

  const tenantId = 't_' + crypto.randomBytes(6).toString('hex');
  const plainPassword = generateStrongPassword(12);
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  const tenant = await Tenant.create({
    tenantId,
    email: normalizedEmail,
    passwordHash,
    name,
    plan,
  });

  return {
    tenant,
    plainPassword,
    adminUrl: `${process.env.APP_URL || ''}/admin.html?tenant=${tenantId}`,
    visitorUrl: `${process.env.APP_URL || ''}/visitor.html?tenant=${tenantId}`,
  };
}

async function detectGeo(ip) {
  try {
    const res = await axios.get(`https://ipapi.co/${ip}/json/`, { timeout: 4000 });
    return {
      country: res.data.country_name || 'Unknown',
      countryCode: res.data.country_code || 'XX',
      city: res.data.city || 'Unknown',
      region: res.data.region || '',
      timezone: res.data.timezone || '',
      isp: res.data.org || '',
      isProxy: res.data.proxy || false,
    };
  } catch (err) {
    return { country: 'Unknown', countryCode: 'XX', city: 'Unknown', region: '', timezone: '', isp: '', isProxy: false };
  }
}

// -------------------------------------------------------------------
// EXPRESS + SOCKET.IO SETUP
// -------------------------------------------------------------------
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});

if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// -------------------------------------------------------------------
// ✅ CRITICAL FIX: EXPLICIT STATIC FILE SERVING WITH ABSOLUTE PATH
// -------------------------------------------------------------------
app.use(express.static(PUBLIC_DIR, {
  maxAge: '1h',
  etag: true,
  lastModified: true,
}));

app.use(
  session({
    name: 'reebow.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

// -------------------------------------------------------------------
// AUTH & API ROUTES
// -------------------------------------------------------------------
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (
      normalizedEmail === process.env.SUPER_ADMIN_EMAIL.toLowerCase() &&
      password === process.env.SUPER_ADMIN_PASSWORD
    ) {
      req.session.admin = { email: normalizedEmail, role: 'super', tenantId: 'super' };
      return res.json({ success: true, role: 'super', tenantId: 'super' });
    }

    const tenant = await Tenant.findOne({ email: normalizedEmail, status: 'active' });
    if (!tenant) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, tenant.passwordHash);
    if (!match) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    tenant.lastLoginAt = new Date();
    await tenant.save();

    req.session.admin = {
      email: tenant.email,
      role: 'tenant',
      tenantId: tenant.tenantId,
      name: tenant.name,
    };

    res.json({ success: true, role: 'tenant', tenantId: tenant.tenantId, name: tenant.name });
  } catch (err) {
    log.error('Login error', { error: err.message });
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

app.get('/api/admin/session', (req, res) => {
  if (req.session.admin) return res.json({ success: true, admin: req.session.admin });
  res.json({ success: false });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.post('/api/provision-tenant', async (req, res) => {
  try {
    const secret = req.headers['x-provision-secret'];
    if (secret !== process.env.SESSION_SECRET) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const { email, plan = 'monthly', name } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });

    const result = await createTenant(email, plan, name);

    res.json({
      success: true,
      tenantId: result.tenant.tenantId,
      email: result.tenant.email,
      temporaryPassword: result.plainPassword,
      adminUrl: result.adminUrl,
      visitorUrl: result.visitorUrl,
      message: 'Save this password now. It will never be shown again.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Visitor Endpoints
app.post('/api/visitor/register', async (req, res) => {
  try {
    const { email, tenantId = 'default' } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });

    const normalizedEmail = email.toLowerCase().trim();
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '';

    let visitor = await Visitor.findOne({ tenantId, email: normalizedEmail });
    if (visitor && visitor.status === 'BANNED') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const geo = await detectGeo(ip);

    if (!visitor) {
      visitor = await Visitor.create({
        email: normalizedEmail,
        tenantId,
        isOnline: true,
        lastSeen: new Date(),
        ...geo,
      });
    } else {
      visitor.isOnline = true;
      visitor.lastSeen = new Date();
      Object.assign(visitor, geo);
      await visitor.save();
    }

    res.json({ success: true, visitor });
  } catch (err) {
    log.error('Register error', { error: err.message });
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

app.post('/api/visitor/heartbeat', async (req, res) => {
  try {
    const { email, tenantId = 'default' } = req.body;
    await Visitor.updateOne(
      { tenantId, email: email?.toLowerCase() },
      { isOnline: true, lastSeen: new Date() }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Admin Protection Middleware
function requireAdmin(req, res, next) {
  if (!req.session.admin) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

app.get('/api/admin/visitors', requireAdmin, async (req, res) => {
  try {
    const admin = req.session.admin;
    const filter = {};

    if (admin.role === 'tenant') {
      filter.tenantId = admin.tenantId;
    } else if (req.query.tenantId) {
      filter.tenantId = req.query.tenantId;
    }

    if (req.query.online === 'true') filter.isOnline = true;

    const visitors = await Visitor.find(filter).sort({ lastSeen: -1 }).limit(100).lean();
    res.json({ success: true, visitors });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load visitors' });
  }
});

app.post('/api/admin/message', requireAdmin, async (req, res) => {
  try {
    const admin = req.session.admin;
    const { email, content, tenantId } = req.body;
    const targetTenantId = admin.role === 'super' ? (tenantId || 'default') : admin.tenantId;

    const visitor = await Visitor.findOne({ tenantId: targetTenantId, email: email.toLowerCase() });
    if (!visitor) return res.status(404).json({ success: false, error: 'Visitor not found' });

    const message = {
      sender: 'admin',
      content,
      messageType: 'text',
      timestamp: new Date(),
      read: false,
    };

    visitor.messages.push(message);
    await visitor.save();

    io.to(`tenant:${targetTenantId}:visitor:${email.toLowerCase()}`).emit('incoming-message', message);
    io.to(`tenant:${targetTenantId}:admin`).emit('message-sent', { email, message });

    res.json({ success: true, message });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

app.post('/api/admin/visitor/ban', requireAdmin, async (req, res) => {
  try {
    const admin = req.session.admin;
    const { email, tenantId } = req.body;
    const targetTenantId = admin.role === 'super' ? tenantId : admin.tenantId;

    await Visitor.updateOne(
      { tenantId: targetTenantId, email: email.toLowerCase() },
      { status: 'BANNED', isOnline: false }
    );

    io.to(`tenant:${targetTenantId}:visitor:${email.toLowerCase()}`).emit('force-disconnect', {
      reason: 'You have been banned',
    });

    res.json({ success: true, message: 'Visitor banned' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ban failed' });
  }
});

// -------------------------------------------------------------------
// SOCKET.IO REAL-TIME ENGINE
// -------------------------------------------------------------------
io.on('connection', (socket) => {
  log.info('Socket connected', { id: socket.id });

  socket.on('visitor-join', async ({ email, tenantId = 'default' }) => {
    if (!email) return;
    const room = `tenant:${tenantId}:visitor:${email.toLowerCase()}`;
    socket.join(room);
    socket.join(`tenant:${tenantId}:visitors`);
    socket.data = { role: 'visitor', email: email.toLowerCase(), tenantId };

    await Visitor.updateOne(
      { tenantId, email: email.toLowerCase() },
      { isOnline: true, lastSeen: new Date() }
    );

    io.to(`tenant:${tenantId}:admin`).emit('visitor-online', { email, tenantId });
  });

  socket.on('admin-join', ({ tenantId }) => {
    if (!tenantId) return;
    socket.join(`tenant:${tenantId}:admin`);
    socket.data = { role: 'admin', tenantId };
  });

  socket.on('send-message', async ({ content }) => {
    const { email, tenantId } = socket.data || {};
    if (!email || !tenantId || !content) return;

    const visitor = await Visitor.findOne({ tenantId, email });
    if (!visitor || visitor.status === 'BANNED') return;

    const message = {
      sender: 'visitor',
      content,
      messageType: 'text',
      timestamp: new Date(),
      read: false,
    };

    visitor.messages.push(message);
    await visitor.save();

    io.to(`tenant:${tenantId}:admin`).emit('incoming-message', { email, message });
  });

  socket.on('disconnect', async () => {
    const { email, tenantId, role } = socket.data || {};
    if (role === 'visitor' && email && tenantId) {
      await Visitor.updateOne(
        { tenantId, email },
        { isOnline: false, lastSeen: new Date() }
      );
      io.to(`tenant:${tenantId}:admin`).emit('visitor-offline', { email });
    }
  });
});

// -------------------------------------------------------------------
// HEALTH CHECK
// -------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0-finalboss',
    timestamp: new Date().toISOString(),
  });
});

// -------------------------------------------------------------------
// SAFE SPA FALLBACK ROUTES (Must be after static & API routes)
// -------------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(join(PUBLIC_DIR, 'index.html'));
});

app.get('/*.html', (req, res) => {
  const filePath = join(PUBLIC_DIR, req.path);
  if (existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).sendFile(join(PUBLIC_DIR, 'index.html'));
  }
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  res.sendFile(join(PUBLIC_DIR, 'index.html'));
});

// -------------------------------------------------------------------
// START SERVER
// -------------------------------------------------------------------
const PORT = process.env.PORT || 10000;

connectMongo()
  .then(() => {
    httpServer.listen(PORT, () => {
      log.info(`🚀 Reebow TECH Final Boss running on port ${PORT}`);
      log.info(`📁 Serving static files from: ${PUBLIC_DIR}`);
    });
  })
  .catch((err) => {
    log.error('Startup failed', { error: err.message });
    process.exit(1);
  });
