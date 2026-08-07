// ════════════════════════════════════════════════════════════════════════
// REEBOW TECH PLATFORM — SERVER.JS
// Single-file backend: Express + Socket.io + Mongoose + Sessions + Webhooks
// Run: npm start  |  Dev: npm run dev
// ════════════════════════════════════════════════════════════════════════

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
import { RateLimiterMemory } from 'rate-limiter-flexible';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

// ────────────────────────────────────────────────────────────────────────
// PATHS & ENV VALIDATION
// ────────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname);
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
const LOGS_DIR = join(PROJECT_ROOT, 'logs');
const CLIPS_DIR = join(PUBLIC_DIR, 'clips');

// Ensure critical directories exist
[LOGS_DIR, CLIPS_DIR].forEach((dir) => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
});

// Required env vars (fail fast on missing)
const requiredEnv = [
  'MONGO_URI',
  'SESSION_SECRET',
  'ADMIN_PASSWORD',
];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`❌ FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// ────────────────────────────────────────────────────────────────────────
// LOGGER (Winston — structured JSON for production)
// ────────────────────────────────────────────────────────────────────────
const logFormat = process.env.LOG_FORMAT === 'simple'
  ? winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
      })
    )
  : winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'reebow-platform' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: join(LOGS_DIR, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: join(LOGS_DIR, 'combined.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

// Helper for consistent logging
const log = {
  info: (msg, meta) => logger.info(msg, meta),
  warn: (msg, meta) => logger.warn(msg, meta),
  error: (msg, meta) => logger.error(msg, meta),
  debug: (msg, meta) => logger.debug(msg, meta),
  http: (msg, meta) => logger.http(msg, meta),
};

// ────────────────────────────────────────────────────────────────────────
// MONGOOSE CONNECTION & SCHEMAS
// ────────────────────────────────────────────────────────────────────────
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME || 'reebow-platform';

mongoose.set('strictQuery', true);

const connectMongo = async () => {
  try {
    await mongoose.connect(mongoUri, {
      dbName,
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE) || 10,
      serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_MS) || 5000,
      socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS) || 45000,
      family: 4, // IPv4 first
    });
    log.info('✅ MongoDB connected', { db: mongoose.connection.name, host: mongoose.connection.host });
  } catch (err) {
    log.error('❌ MongoDB connection failed', { error: err.message, stack: err.stack });
    throw err;
  }
};

mongoose.connection.on('disconnected', () => log.warn('⚠️ MongoDB disconnected'));
mongoose.connection.on('reconnected', () => log.info('✅ MongoDB reconnected'));
mongoose.connection.on('error', (err) => log.error('❌ MongoDB error', { error: err.message }));

// ────────────────────────────────────────────────────────────────────────
// MODELS
// ────────────────────────────────────────────────────────────────────────

// Visitor / Tenant (single-tenant mode: tenantId = 'default')
const visitorSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    tenantId: { type: String, default: 'default', index: true },
    country: { type: String, default: 'US' },
    countryCode: { type: String, default: 'US' },
    city: { type: String },
    region: { type: String },
    timezone: { type: String },
    isp: { type: String },
    org: { type: String },
    isMobile: { type: Boolean, default: false },
    isProxy: { type: Boolean, default: false },
    isHosting: { type: Boolean, default: false },
    status: { type: String, enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED'], default: 'PENDING' },
    sourcePanel: { type: String, default: 'default' },
    customAdminName: { type: String, default: 'Support Agent' },
    adminPassword: { type: String }, // For multi-tenant: unique per tenant
    language: { type: String, default: 'en' },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    lastGeoUpdate: { type: Date },
    messages: [
      {
        sender: { type: String, enum: ['visitor', 'admin', 'system'], required: true },
        content: { type: String, required: true },
        translation: { type: String },
        messageType: { type: String, enum: ['text', 'image', 'video', 'file', 'system'], default: 'text' },
        mediaUrl: { type: String },
        timestamp: { type: Date, default: Date.now },
        read: { type: Boolean, default: false },
      },
    ],
    callLogs: [
      {
        type: { type: String, enum: ['incoming', 'outgoing', 'missed', 'rejected'], required: true },
        status: { type: String, enum: ['connected', 'ended', 'failed', 'timeout'], required: true },
        duration: { type: Number, default: 0 }, // seconds
        recordingUrl: { type: String },
        notes: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    settings: {
      notifications: { type: Boolean, default: true },
      theme: { type: String, enum: ['dark', 'light', 'auto'], default: 'dark' },
      language: { type: String, default: 'en' },
    },
    metadata: { type: Map, of: String }, // Flexible extra data
  },
  {
    timestamps: true,
    collection: 'visitors',
  }
);

// Indexes for performance
visitorSchema.index({ tenantId: 1, email: 1 }, { unique: true });
visitorSchema.index({ tenantId: 1, isOnline: 1, lastSeen: -1 });
visitorSchema.index({ 'messages.timestamp': -1 });
visitorSchema.index({ 'callLogs.timestamp': -1 });

const Visitor = mongoose.model('Visitor', visitorSchema);

// Admin Session (for multi-tenant admin logins)
const adminSessionSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    adminEmail: { type: String, required: true },
    sessionToken: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String },
    ip: { type: String },
  },
  { timestamps: true, collection: 'admin_sessions' }
);
adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
const AdminSession = mongoose.model('AdminSession', adminSessionSchema);

// ────────────────────────────────────────────────────────────────────────
// EXPRESS APP & MIDDLEWARE
// ────────────────────────────────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);

// Trust proxy (required for rate limiting & secure cookies behind Render/Railway/Cloudflare)
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.HELMET_CSP_ENABLED === 'true'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              mediaSrc: ["'self'", 'blob:', 'https:'],
              connectSrc: ["'self'", 'wss:', 'https:'],
              frameSrc: ["'none'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
          }
        : false,
    crossOriginEmbedderPolicy: false,
    hsts: process.env.NODE_ENV === 'production',
  })
);

// CORS
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : process.env.NODE_ENV === 'production'
  ? [] // Empty = no cross-origin allowed
  : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400,
  })
);

// Compression
app.use(compression({ level: 6, threshold: 1024 }));

// Body parsers
app.use(express.json({ limit: '1mb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Session store
const sessionStore = MongoStore.create({
  client: mongoose.connection.getClient(),
  dbName,
  collectionName: 'sessions',
  ttl: Math.floor((parseInt(process.env.SESSION_MAX_AGE_MS) || 2592000000) / 1000),
  autoRemove: 'interval',
  autoRemoveInterval: 60, // minutes
  crypto: { secret: process.env.SESSION_SECRET },
});

const sessionMiddleware = session({
  name: process.env.SESSION_NAME || 'reebow.sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.SESSION_SECURE_COOKIES === 'true',
    httpOnly: true,
    sameSite: process.env.SESSION_SAME_SITE || 'lax',
    maxAge: parseInt(process.env.SESSION_MAX_AGE_MS) || 2592000000,
    domain:
      process.env.NODE_ENV === 'production' ? new URL(process.env.APP_URL).hostname : undefined,
  },
});

app.use(sessionMiddleware);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production' || duration > 1000 || res.statusCode >= 400) {
      log.http(`${req.method} ${req.originalUrl}`, {
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        ua: req.get('user-agent')?.substring(0, 100),
      });
    }
  });
  next();
});

// ────────────────────────────────────────────────────────────────────────
// RATE LIMITERS
// ────────────────────────────────────────────────────────────────────────
const globalLimiter = new RateLimiterMemory({
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000 || 900, // seconds
});

const loginLimiter = new RateLimiterMemory({
  points: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
  duration: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) / 1000 || 900,
});

const rateLimitMiddleware = (limiter, keyPrefix = 'global') => async (req, res, next) => {
  if (process.env.DEV_DISABLE_RATE_LIMIT === 'true') return next();
  try {
    const key = `${keyPrefix}:${req.ip}`;
    await limiter.consume(key);
    next();
  } catch (rej) {
    const secs = Math.round(rej.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    log.warn('Rate limit exceeded', { ip: req.ip, path: req.path, retryAfter: secs });
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      retryAfter: secs,
    });
  }
};

app.use(rateLimitMiddleware(globalLimiter, 'global'));

// ────────────────────────────────────────────────────────────────────────
// STATIC FILES & SPA FALLBACK
// ────────────────────────────────────────────────────────────────────────
app.use(express.static(PUBLIC_DIR, {
  maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) res.set('Cache-Control', 'no-cache, must-revalidate');
    if (path.endsWith('.js') || path.endsWith('.css')) res.set('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

// ────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ────────────────────────────────────────────────────────────────────────

async function getOrCreateVisitor(email, tenantId = 'default', extra = {}) {
  const normalizedEmail = email.toLowerCase().trim();
  let visitor = await Visitor.findOne({ tenantId, email: normalizedEmail });
  if (!visitor) {
    visitor = await Visitor.create({ tenantId, email: normalizedEmail, ...extra });
    log.info('👤 New visitor created', { tenantId, email: normalizedEmail });
  }
  return visitor;
}

async function updateVisitorOnlineStatus(email, tenantId, isOnline) {
  await Visitor.updateOne(
    { tenantId, email: email.toLowerCase().trim() },
    { $set: { isOnline, lastSeen: new Date() } }
  );
}

function buildVisitorPayload(visitor) {
  return {
    id: visitor._id,
    email: visitor.email,
    tenantId: visitor.tenantId,
    country: visitor.country,
    countryCode: visitor.countryCode,
    city: visitor.city,
    region: visitor.region,
    timezone: visitor.timezone,
    isp: visitor.isp,
    org: visitor.org,
    isMobile: visitor.isMobile,
    isProxy: visitor.isProxy,
    isHosting: visitor.isHosting,
    status: visitor.status,
    sourcePanel: visitor.sourcePanel,
    customAdminName: visitor.customAdminName,
    language: visitor.language,
    isOnline: visitor.isOnline,
    lastSeen: visitor.lastSeen,
    messages: visitor.messages.slice(-100), // Last 100 messages
    callLogs: visitor.callLogs.slice(-20),
    settings: visitor.settings,
  };
}

// Geo lookup (ip-api.com free tier)
async function fetchGeo(ip) {
  if (process.env.DEV_MOCK_GEO === 'true') {
    return {
      country: process.env.DEV_MOCK_GEO_COUNTRY || 'United States',
      countryCode: 'US',
      city: process.env.DEV_MOCK_GEO_CITY || 'San Francisco',
      region: 'CA',
      timezone: 'America/Los_Angeles',
      isp: 'Mock ISP',
      org: 'Mock Org',
      as: 'AS12345 Mock',
      mobile: false,
      proxy: false,
      hosting: false,
      query: ip,
    };
  }
  try {
    const { default: fetch } = await import('node-fetch');
    const fields = process.env.IP_API_FIELDS || 'country,countryCode,city,region,timezone,isp,org,as,mobile,proxy,hosting,query';
    const url = `${process.env.IP_API_URL || 'http://ip-api.com/json/'}${ip}?fields=${fields}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), parseInt(process.env.IP_API_TIMEOUT_MS) || 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    log.warn('Geo lookup failed', { ip, error: err.message });
    return { countryCode: 'XX', country: 'Unknown' };
  }
}

// ────────────────────────────────────────────────────────────────────────
// API ROUTES
// ────────────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    version: process.env.npm_package_version || '2.0.0',
  });
});

// API version
app.get('/api/version', (req, res) => {
  res.json({ version: process.env.npm_package_version || '2.0.0', name: process.env.APP_NAME });
});

// ── Visitor Registration ──
app.post('/api/visitor/register', rateLimitMiddleware(new RateLimiterMemory({ points: 10, duration: 60 }), 'register'), async (req, res) => {
  try {
    const { email, tenantId = 'default', language, sourcePanel } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email required' });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const clientIp = req.ip || req.connection.remoteAddress;
    const geo = await fetchGeo(clientIp);

    const visitor = await getOrCreateVisitor(normalizedEmail, tenantId, {
      country: geo.country,
      countryCode: geo.countryCode,
      city: geo.city,
      region: geo.region,
      timezone: geo.timezone,
      isp: geo.isp,
      org: geo.org,
      isMobile: geo.mobile,
      isProxy: geo.proxy,
      isHosting: geo.hosting,
      language: language || process.env.DEFAULT_LANGUAGE || 'en',
      sourcePanel: sourcePanel || 'direct',
      status: 'ACTIVE',
    });

    req.session.visitorEmail = normalizedEmail;
    req.session.tenantId = tenantId;
    await updateVisitorOnlineStatus(normalizedEmail, tenantId, true);

    res.json({ success: true, visitor: buildVisitorPayload(visitor) });
  } catch (err) {
    log.error('Visitor registration failed', { error: err.message, body: req.body });
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// ── Visitor Heartbeat ──
app.post('/api/visitor/heartbeat', async (req, res) => {
  const { email, tenantId = 'default' } = req.body;
  if (!email) return res.status(400).json({ success: false });
  await updateVisitorOnlineStatus(email.toLowerCase(), tenantId, true);
  res.json({ success: true });
});

// ── Get Visitor Data (Admin) ──
app.get('/api/admin/visitor/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { tenantId = 'default' } = req.query;
    const visitor = await Visitor.findOne({ tenantId, email: email.toLowerCase() });
    if (!visitor) return res.status(404).json({ success: false, error: 'Visitor not found' });
    res.json({ success: true, visitor: buildVisitorPayload(visitor) });
  } catch (err) {
    log.error('Get visitor failed', { error: err.message });
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ── List Visitors (Admin) ──
app.get('/api/admin/visitors', async (req, res) => {
  try {
    const { tenantId = 'default', status, online, search, limit = 50, offset = 0 } = req.query;
    const query = { tenantId };
    if (status) query.status = status;
    if (online === 'true') query.isOnline = true;
    if (search) {
      const regex = new RegExp(search.toLowerCase(), 'i');
      query.$or = [{ email: regex }, { city: regex }, { country: regex }];
    }
    const [visitors, total] = await Promise.all([
      Visitor.find(query)
        .sort({ isOnline: -1, lastSeen: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .lean(),
      Visitor.countDocuments(query),
    ]);
    res.json({
      success: true,
      visitors: visitors.map(buildVisitorPayload),
      pagination: { total, limit: parseInt(limit), offset: parseInt(offset) },
    });
  } catch (err) {
    log.error('List visitors failed', { error: err.message });
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ── Admin Login ──
app.post('/api/admin/login', rateLimitMiddleware(loginLimiter, 'login'), async (req, res) => {
  try {
    const { email, password, tenantId = 'default', remember } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required' });

    // Single-tenant mode: check against env ADMIN_PASSWORD + ADMIN_EMAIL
    if (tenantId === 'default') {
      if (email.toLowerCase() !== process.env.ADMIN_EMAIL.toLowerCase()) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }
      if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }
      req.session.admin = { email, tenantId, role: 'super' };
      req.session.adminExpires = Date.now() + (parseInt(process.env.ADMIN_SESSION_TTL_MS) || 3600000);
      return res.json({ success: true, role: 'super', tenantId });
    }

    // Multi-tenant mode: check against visitor adminPassword
    const visitor = await Visitor.findOne({ tenantId, email: email.toLowerCase(), adminPassword: password });
    if (!visitor) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    req.session.admin = { email, tenantId, role: 'tenant' };
    req.session.adminExpires = Date.now() + (parseInt(process.env.ADMIN_SESSION_TTL_MS) || 3600000);
    res.json({ success: true, role: 'tenant', tenantId, customAdminName: visitor.customAdminName });
  } catch (err) {
    log.error('Admin login failed', { error: err.message });
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// ── Admin Logout ──
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ success: false });
    res.clearCookie(process.env.SESSION_NAME || 'reebow.sid');
    res.json({ success: true });
  });
});

// ── Admin Session Check ──
app.get('/api/admin/session', (req, res) => {
  if (req.session.admin && req.session.adminExpires > Date.now()) {
    return res.json({ success: true, admin: req.session.admin });
  }
  res.json({ success: false });
});

// ── Send Message (Admin → Visitor) ──
app.post('/api/admin/message', async (req, res) => {
  try {
    const { email, content, tenantId = 'default', messageType = 'text', mediaUrl } = req.body;
    if (!email || !content) return res.status(400).json({ success: false, error: 'Email and content required' });
    const visitor = await Visitor.findOne({ tenantId, email: email.toLowerCase() });
    if (!visitor) return res.status(404).json({ success: false, error: 'Visitor not found' });

    const message = {
      sender: 'admin',
      content,
      messageType,
      mediaUrl,
      timestamp: new Date(),
      read: false,
    };
    visitor.messages.push(message);
    await visitor.save();

    // Emit via Socket.io
    req.io?.to(`room-${tenantId}-${email.toLowerCase()}`)?.emit('incoming-message', { ...message, _id: message._id });

    res.json({ success: true, message });
  } catch (err) {
    log.error('Send message failed', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to send' });
  }
});

// ── Initiate Call (Admin → Visitor) ──
app.post('/api/admin/call/initiate', async (req, res) => {
  try {
    const { email, tenantId = 'default', persona = process.env.DEFAULT_PERSONA || 'annie' } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });
    const visitor = await Visitor.findOne({ tenantId, email: email.toLowerCase() });
    if (!visitor) return res.status(404).json({ success: false, error: 'Visitor not found' });

    const callData = { targetEmail: email.toLowerCase(), tenantId, persona, initiatedBy: 'admin', timestamp: new Date() };
    req.io?.to(`room-${tenantId}-${email.toLowerCase()}`)?.emit('incoming-call', callData);

    res.json({ success: true, callId: uuidv4() });
  } catch (err) {
    log.error('Initiate call failed', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to initiate call' });
  }
});

// ── Payment Webhook (Multi-tenant Provisioning) ──
app.post('/api/payment-webhook', async (req, res) => {
  try {
    const { clientEmail, customPassword, tenantId, plan = 'monthly', provider = 'manual' } = req.body;
    if (!clientEmail) return res.status(400).json({ success: false, error: 'clientEmail required' });

    const tenant = tenantId || `tenant_${uuidv4().slice(0, 8)}`;
    const normalizedEmail = clientEmail.toLowerCase().trim();
    const assignedPassword = customPassword || `${process.env.DEFAULT_ADMIN_PASSWORD_PREFIX || 'Support_'}${uuidv4().slice(0, 8)}`;

    let visitor = await Visitor.findOne({ tenantId: tenant, email: normalizedEmail });
    if (!visitor) {
      visitor = await Visitor.create({
        tenantId: tenant,
        email: normalizedEmail,
        adminPassword: assignedPassword,
        status: process.env.DEFAULT_TENANT_STATUS || 'ACTIVE',
        sourcePanel: provider,
        metadata: new Map([['plan', plan], ['provisionedAt', new Date().toISOString()]]),
      });
    } else {
      visitor.status = process.env.DEFAULT_TENANT_STATUS || 'ACTIVE';
      visitor.adminPassword = assignedPassword;
      visitor.metadata = new Map([...visitor.metadata, ['plan', plan], ['updatedAt', new Date().toISOString()]]);
      await visitor.save();
    }

    const adminUrl = `${process.env.APP_URL}/admin.html?tenant=${tenant}`;
    const visitorUrl = `${process.env.APP_URL}/visitor.html?tenant=${tenant}`;

    log.info('✅ Tenant provisioned', { tenant, email: normalizedEmail, provider, plan });

    res.json({
      success: true,
      tenant,
      adminUrl,
      visitorUrl,
      adminEmail: normalizedEmail,
      adminPassword: assignedPassword,
      hotlines: {
        primary: process.env.HOTLINE_PRIMARY,
        secondary: process.env.HOTLINE_SECONDARY,
        whatsapp: process.env.HOTLINE_WHATSAPP,
      },
    });
  } catch (err) {
    log.error('Payment webhook failed', { error: err.message, body: req.body });
    res.status(500).json({ success: false, error: 'Provisioning failed' });
  }
});

// ── Clip Manifest (for video injector) ──
app.get('/api/clips/manifest', (req, res) => {
  const manifestPath = join(CLIPS_DIR, 'manifest.json');
  if (existsSync(manifestPath)) {
    return res.sendFile(manifestPath);
  }
  res.json({ success: false, error: 'Manifest not found', clips: {} });
});

// ────────────────────────────────────────────────────────────────────────
// SOCKET.IO — REALTIME ENGINE
// ────────────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 10000,
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 5000,
  upgradeTimeout: parseInt(process.env.SOCKET_UPGRADE_TIMEOUT) || 30000,
  maxHttpBufferSize: parseInt(process.env.SOCKET_MAX_PAYLOAD_BYTES) || 1048576,
  allowEIO3: process.env.SOCKET_ALLOW_EIO3 === 'true',
  cors: { origin: corsOrigins.length ? corsOrigins : false, credentials: true },
});

// Share session with Socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Attach io instance to request object for routers
app.use((req, res, next) => {
  req.io = io;
  next();
});

function roomName(tenantId, email) {
  return `room-${tenantId}-${email.toLowerCase()}`;
}

io.on('connection', (socket) => {
  const { session } = socket.request;
  let currentRoom = null;
  let currentEmail = null;
  let currentTenant = 'default';
  let isAdmin = false;

  log.debug('Socket connected', { id: socket.id, ip: socket.handshake.address });

  socket.on('admin-join', async ({ email, tenantId = 'default' }) => {
    if (!session.admin || session.adminExpires <= Date.now()) {
      return socket.emit('admin-authenticate', { success: false, error: 'Not authenticated' });
    }
    if (!email) return socket.emit('admin-authenticate', { success: false, error: 'Email required' });

    const visitor = await Visitor.findOne({ tenantId, email: email.toLowerCase() });
    if (!visitor) return socket.emit('admin-authenticate', { success: false, error: 'Visitor not found' });

    currentEmail = email.toLowerCase();
    currentTenant = tenantId;
    currentRoom = roomName(tenantId, currentEmail);
    isAdmin = true;

    socket.join(currentRoom);
    socket.emit('admin-authenticate', { success: true });
    log.info('Admin joined room', { room: currentRoom });
  });

  socket.on('visitor-join', async ({ email, tenantId = 'default' }) => {
    if (!email) return;
    currentEmail = email.toLowerCase();
    currentTenant = tenantId;
    currentRoom = roomName(tenantId, currentEmail);
    isAdmin = false;

    socket.join(currentRoom);
    await updateVisitorOnlineStatus(currentEmail, currentTenant, true);
    socket.to(currentRoom).emit('visitor-status', { online: true });
  });

  socket.on('send-message', async ({ content, messageType = 'text', mediaUrl }) => {
    if (!currentEmail || !currentRoom || !content) return;
    const visitor = await Visitor.findOne({ tenantId: currentTenant, email: currentEmail });
    if (!visitor) return;

    const sender = isAdmin ? 'admin' : 'visitor';
    const message = { sender, content, messageType, mediaUrl, timestamp: new Date(), read: false };
    
    visitor.messages.push(message);
    await visitor.save();

    io.to(currentRoom).emit('incoming-message', { ...message, _id: message._id });
  });

  socket.on('disconnect', async () => {
    if (!isAdmin && currentEmail) {
      await updateVisitorOnlineStatus(currentEmail, currentTenant, false);
      if (currentRoom) {
        socket.to(currentRoom).emit('visitor-status', { online: false });
      }
    }
    log.debug('Socket disconnected', { id: socket.id });
  });
});

// ────────────────────────────────────────────────────────────────────────
// START SERVER
// ────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 10000;

connectMongo()
  .then(() => {
    httpServer.listen(PORT, () => {
      log.info(`🚀 Reebow TECH platform running on port ${PORT}`, { env: process.env.NODE_ENV || 'development' });
    });
  })
  .catch((err) => {
    log.error('Failed to start server due to DB connection error', { error: err.message });
    process.exit(1);
  });
