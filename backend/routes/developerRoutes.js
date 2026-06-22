const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const os = require('os');
const bcrypt = require('bcryptjs');
const Log = require('../models/Log');
const User = require('../models/User');
const Property = require('../models/Property');
const UploadToken = require('../models/UploadToken');
const MaintenanceMode = require('../models/MaintenanceMode');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { resetIP, getLimiterConfig } = require('../middleware/rateLimiters');
const { logEvent } = require('../middleware/requestLogger');

// --- Input-hardening helpers (defense in depth on the highest-trust console) ---
// Escape user input before it is used inside a Mongoose $regex so a crafted
// value can neither inject regex operators nor trigger ReDoS.
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Coerce a query param to a bounded integer; rejects NaN / objects / huge values.
const clampInt = (val, def, min, max) => {
  const n = Math.floor(Number(val));
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
};

// All developer routes require DEVELOPER role
router.use(verifyToken, requireRole('DEVELOPER'));

// ==========================================
// 1. REQUEST LOGS — paginated, filterable
// ==========================================
// GET /api/developer/logs
router.get('/logs', async (req, res) => {
  try {
    const {
      type,         // REQUEST | ERROR | WARNING | INFO
      method,       // GET | POST | PUT | DELETE
      route,        // partial match
      statusCode,   // exact or range: "4xx", "5xx"
      ip,
      userId,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = req.query;

    const query = {};

    if (type && type !== 'ALL') query.type = String(type);
    if (method) query.method = String(method).toUpperCase();
    if (route) query.route = { $regex: escapeRegex(route), $options: 'i' };
    if (ip) query.ip = { $regex: escapeRegex(ip) };
    if (userId) query.userId = String(userId);

    if (statusCode) {
      if (statusCode === '4xx') query.statusCode = { $gte: 400, $lt: 500 };
      else if (statusCode === '5xx') query.statusCode = { $gte: 500 };
      else if (statusCode === '2xx') query.statusCode = { $gte: 200, $lt: 300 };
      else query.statusCode = Number(statusCode);
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const safeLimit  = clampInt(limit, 50, 1, 200);
    const safeOffset = clampInt(offset, 0, 0, 1_000_000);

    const [logs, total] = await Promise.all([
      Log.find(query)
        .sort({ createdAt: -1 })
        .skip(safeOffset)
        .limit(safeLimit)
        .lean(),
      Log.countDocuments(query)
    ]);

    res.json({ logs, total, offset: safeOffset, limit: safeLimit });
  } catch (error) {
    console.error('Dev logs error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 2. ERROR & WARNING SUMMARY
// ==========================================
// GET /api/developer/errors
router.get('/errors', async (req, res) => {
  try {
    const hours = clampInt(req.query.hours, 24, 1, 720); // max 30 days
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [errors, warnings, errorsByRoute] = await Promise.all([
      Log.find({ type: 'ERROR', createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),

      Log.find({ type: 'WARNING', createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),

      Log.aggregate([
        { $match: { type: 'ERROR', createdAt: { $gte: since } } },
        { $group: { _id: { route: '$route', statusCode: '$statusCode' }, count: { $sum: 1 }, lastSeen: { $max: '$createdAt' } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ])
    ]);

    res.json({ errors, warnings, errorsByRoute, period: `Last ${hours}h` });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 3. DATABASE STATS
// ==========================================
// GET /api/developer/stats/db
router.get('/stats/db', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const dbStats = await db.stats();

    // Get all collection names
    const collectionInfos = await db.listCollections().toArray();
    const collectionNames = collectionInfos.map(c => c.name);

    // Fetch stats for each collection
    const collections = await Promise.all(
      collectionNames.map(async (name) => {
        try {
          const stats = await db.collection(name).stats();
          return {
            name,
            count: stats.count || 0,
            size: stats.size || 0,         // bytes
            avgObjSize: stats.avgObjSize || 0,
            storageSize: stats.storageSize || 0,
            nindexes: stats.nindexes || 0,
            totalIndexSize: stats.totalIndexSize || 0
          };
        } catch {
          return { name, count: 0, size: 0, avgObjSize: 0, storageSize: 0, nindexes: 0, totalIndexSize: 0 };
        }
      })
    );

    res.json({
      database: mongoose.connection.name,
      totalSize: dbStats.dataSize || 0,
      storageSize: dbStats.storageSize || 0,
      indexSize: dbStats.indexSize || 0,
      collections: collections.sort((a, b) => b.count - a.count),
      mongoVersion: (await db.admin().serverInfo()).version || 'unknown'
    });
  } catch (error) {
    console.error('DB stats error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 4. SYSTEM / PROCESS STATS
// ==========================================
// GET /api/developer/stats/system
router.get('/stats/system', async (req, res) => {
  try {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    res.json({
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime: process.uptime(),         // seconds
        uptimeHuman: formatUptime(process.uptime())
      },
      memory: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        rss: mem.rss,
        external: mem.external,
        heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(2),
        rssMB: (mem.rss / 1024 / 1024).toFixed(2)
      },
      os: {
        type: os.type(),
        release: os.release(),
        hostname: os.hostname(),
        cpus: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || 'Unknown',
        totalMemMB: (totalMem / 1024 / 1024).toFixed(0),
        freeMemMB: (freeMem / 1024 / 1024).toFixed(0),
        memUsagePercent: (((totalMem - freeMem) / totalMem) * 100).toFixed(1)
      },
      env: process.env.NODE_ENV || 'development',
      mongodb: {
        state: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        host: mongoose.connection.host || 'unknown',
        port: mongoose.connection.port || 'unknown',
        name: mongoose.connection.name || 'unknown'
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 5. API USAGE ANALYTICS
// ==========================================
// GET /api/developer/stats/api
router.get('/stats/api', async (req, res) => {
  try {
    const hours = clampInt(req.query.hours, 24, 1, 720); // max 30 days
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [
      totalRequests,
      byStatus,
      byRoute,
      byDevice,
      byHour,
      avgResponseTime,
      topIPs,
      statusBreakdown
    ] = await Promise.all([
      // Total count
      Log.countDocuments({ type: 'REQUEST', createdAt: { $gte: since } }),

      // Group by status category
      Log.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),

      // Top routes by traffic
      Log.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: {
          _id: { method: '$method', route: '$route' },
          count: { $sum: 1 },
          avgTime: { $avg: '$responseTime' },
          errors: { $sum: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] } }
        }},
        { $sort: { count: -1 } },
        { $limit: 15 }
      ]),

      // Requests by device type
      Log.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$device', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Requests per hour (timeline)
      Log.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%dT%H:00:00', date: '$createdAt' } },
          count: { $sum: 1 },
          errors: { $sum: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] } }
        }},
        { $sort: { _id: 1 } }
      ]),

      // Average response time across all requests
      Log.aggregate([
        { $match: { createdAt: { $gte: since }, responseTime: { $exists: true } } },
        { $group: { _id: null, avg: { $avg: '$responseTime' }, max: { $max: '$responseTime' }, min: { $min: '$responseTime' } } }
      ]),

      // Top IPs
      Log.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$ip', count: { $sum: 1 }, device: { $first: '$device' } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      // HTTP status code distribution
      Log.aggregate([
        { $match: { createdAt: { $gte: since }, statusCode: { $exists: true } } },
        { $group: { _id: '$statusCode', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    res.json({
      period: `Last ${hours}h`,
      totalRequests,
      byStatus: Object.fromEntries(byStatus.map(s => [s._id, s.count])),
      byRoute,
      byDevice,
      byHour,
      responseTime: avgResponseTime[0] || { avg: 0, max: 0, min: 0 },
      topIPs,
      statusBreakdown
    });
  } catch (error) {
    console.error('API stats error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 6. RATE LIMIT STATUS
// ==========================================
// GET /api/developer/stats/ratelimits
router.get('/stats/ratelimits', async (req, res) => {
  try {
    const hours = clampInt(req.query.hours, 1, 1, 720); // max 30 days
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // IPs that hit auth routes heavily (potential brute force)
    const authHits = await Log.aggregate([
      { $match: { route: { $regex: '/api/auth' }, createdAt: { $gte: since } } },
      { $group: { _id: '$ip', count: { $sum: 1 }, lastSeen: { $max: '$createdAt' }, device: { $first: '$device' }, os: { $first: '$os' } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    // IPs with most 429 responses
    const throttledIPs = await Log.aggregate([
      { $match: { statusCode: 429, createdAt: { $gte: since } } },
      { $group: { _id: '$ip', count: { $sum: 1 }, lastSeen: { $max: '$createdAt' } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    res.json({
      config: getLimiterConfig(),
      authHits,
      throttledIPs,
      period: `Last ${hours}h`
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 7. RESET RATE LIMIT FOR AN IP
// ==========================================
// POST /api/developer/rate-limits/reset
router.post('/rate-limits/reset', (req, res) => {
  const ip = typeof req.body.ip === 'string' ? req.body.ip.trim() : '';
  // Accept only plausible IPv4/IPv6 literals — never an object or arbitrary string.
  const isValidIp = /^[0-9a-fA-F:.]{3,45}$/.test(ip);
  if (!ip || !isValidIp) return res.status(400).json({ message: 'A valid IP address is required.' });
  resetIP(ip);
  res.json({ message: `Rate limit cleared for ${ip}. They can now make requests immediately.` });
});

// ==========================================
// 8. CLEAR OLD LOGS (manual cleanup)
// ==========================================
// DELETE /api/developer/logs/purge?days=30
router.delete('/logs/purge', async (req, res) => {
  try {
    const days = clampInt(req.query.days, 30, 1, 3650);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await Log.deleteMany({ createdAt: { $lt: cutoff } });
    res.json({ message: `Deleted ${result.deletedCount} log entries older than ${days} days.` });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// DELETE /api/developer/logs/all
router.delete('/logs/all', async (req, res) => {
  try {
    const result = await Log.deleteMany({});
    res.json({ message: `Deleted all ${result.deletedCount} log entries.` });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 9. ALL STAFF USERS (user management)
// ==========================================
// GET /api/developer/users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'SUPER_ADMIN' } })
      .select('-password -refreshToken')
      .populate('assignedProperty', 'name status')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 10a. APPROVE UNVERIFIED ACCOUNT (Developer override — skips OTP)
// ==========================================
// PATCH /api/developer/users/:id/approve
router.patch('/users/:id/approve', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.isVerified) return res.json({ message: 'Account is already verified.' });
    user.isVerified    = true;
    user.emailVerified = true;
    await user.save();
    logEvent('INFO', `Account approved by Developer: ${user.name} (${user.role})`, { userId: user._id, email: user.email });
    res.json({ message: `${user.name}'s account has been approved.` });
  } catch (err) {
    console.error('Approve user error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 10. SUSPEND / UNSUSPEND ANY USER
// ==========================================
// PATCH /api/developer/users/:id/suspend
router.patch('/users/:id/suspend', async (req, res) => {
  try {
    const { suspended, reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.role === 'SUPER_ADMIN') return res.status(403).json({ message: 'Cannot suspend Super Admin.' });

    user.suspended = !!suspended;
    user.suspendedReason = suspended ? (reason || 'Suspended by developer.') : null;
    if (suspended) user.refreshToken = null;
    await user.save();
    res.json({ message: `User ${suspended ? 'suspended' : 'reactivated'} successfully.` });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 11. FORCE LOGOUT USER (revoke refresh token)
// ==========================================
// DELETE /api/developer/users/:id/session
router.delete('/users/:id/session', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    user.refreshToken = null;
    await user.save();
    res.json({ message: `Session revoked for ${user.name}. They will be logged out on next action.` });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 12. RESET USER PASSWORD
// ==========================================
// PATCH /api/developer/users/:id/reset-password
router.patch('/users/:id/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.role === 'SUPER_ADMIN') return res.status(403).json({ message: 'Cannot reset Super Admin password from here.' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.refreshToken = null;
    await user.save();
    res.json({ message: `Password reset for ${user.name}. They must log in again.` });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 13. ALL HOTELS (with manager + status)
// ==========================================
// GET /api/developer/hotels
router.get('/hotels', async (req, res) => {
  try {
    const hotels = await Property.find()
      .populate('owner', 'name email suspended')
      .sort({ createdAt: -1 });

    const managers = await User.find({ role: 'HOTEL_MANAGER', assignedProperty: { $ne: null } })
      .select('name email suspended assignedProperty');

    const managerMap = {};
    for (const m of managers) {
      managerMap[m.assignedProperty.toString()] = m;
    }

    const result = hotels.map(h => ({
      ...h.toObject(),
      manager: managerMap[h._id.toString()] || null
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 14. SUSPEND / REACTIVATE HOTEL
// ==========================================
// PATCH /api/developer/hotels/:id/suspend
router.patch('/hotels/:id/suspend', async (req, res) => {
  try {
    const { suspended } = req.body;
    const hotel = await Property.findById(req.params.id);
    if (!hotel) return res.status(404).json({ message: 'Hotel not found.' });

    hotel.status = suspended ? 'SUSPENDED' : 'ACTIVE';
    await hotel.save();
    res.json({ message: `Hotel ${suspended ? 'suspended' : 'reactivated'} successfully.` });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 15. UNASSIGN MANAGER FROM HOTEL
// ==========================================
// DELETE /api/developer/hotels/:id/manager
router.delete('/hotels/:id/manager', async (req, res) => {
  try {
    const manager = await User.findOne({ role: 'HOTEL_MANAGER', assignedProperty: req.params.id });
    if (!manager) return res.status(404).json({ message: 'No manager assigned to this hotel.' });

    manager.assignedProperty = null;
    await manager.save();
    res.json({ message: `Manager ${manager.name} unassigned from hotel.` });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 16. CLEANUP STATS
// ==========================================
// GET /api/developer/cleanup/stats
router.get('/cleanup/stats', async (req, res) => {
  try {
    const now = new Date();
    const [expiredTokens, totalTokens, oldLogs30d, totalLogs] = await Promise.all([
      UploadToken.countDocuments({ expiresAt: { $lt: now } }),
      UploadToken.countDocuments(),
      Log.countDocuments({ createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      Log.countDocuments()
    ]);
    res.json({ expiredTokens, totalTokens, oldLogs30d, totalLogs });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 17. PURGE EXPIRED UPLOAD TOKENS
// ==========================================
// DELETE /api/developer/cleanup/tokens
router.delete('/cleanup/tokens', async (req, res) => {
  try {
    const result = await UploadToken.deleteMany({ expiresAt: { $lt: new Date() } });
    res.json({ message: `Deleted ${result.deletedCount} expired upload token(s).`, deleted: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 18. DB STORAGE THRESHOLD CHECK
// ==========================================
// GET /api/developer/stats/db-health
// Returns usage % against a configurable limit (default: 512MB MongoDB Atlas free tier)
router.get('/stats/db-health', async (req, res) => {
  try {
    const limitMB = Number(process.env.DB_STORAGE_LIMIT_MB) || 512;
    const db = mongoose.connection.db;
    const dbStats = await db.stats();
    const usedMB = ((dbStats.dataSize + dbStats.indexSize) / 1024 / 1024);
    const usedPct = (usedMB / limitMB) * 100;

    res.json({
      usedMB:    parseFloat(usedMB.toFixed(2)),
      limitMB,
      usedPct:   parseFloat(usedPct.toFixed(1)),
      status:    usedPct >= 95 ? 'DANGER' : usedPct >= 80 ? 'WARNING' : 'OK',
      dataSize:  dbStats.dataSize,
      indexSize: dbStats.indexSize
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 19. R2 STORAGE STATS
// ==========================================
// GET /api/developer/stats/r2
router.get('/stats/r2', async (req, res) => {
  try {
    const { isConfigured } = require('../utils/r2');
    if (!isConfigured()) {
      return res.json({ configured: false });
    }

    const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     process.env.CF_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY,
      },
    });

    let totalSize = 0;
    let totalObjects = 0;
    let continuationToken;

    do {
      const cmd = new ListObjectsV2Command({
        Bucket: process.env.CF_R2_BUCKET_NAME,
        ContinuationToken: continuationToken,
      });
      const page = await client.send(cmd);
      for (const obj of (page.Contents || [])) totalSize += obj.Size || 0;
      totalObjects += (page.Contents || []).length;
      continuationToken = page.IsTruncated ? page.NextContinuationToken : null;
    } while (continuationToken);

    const limitBytes = 10 * 1024 * 1024 * 1024; // 10 GB free tier
    const usedPct = (totalSize / limitBytes) * 100;

    res.json({
      configured:    true,
      bucket:        process.env.CF_R2_BUCKET_NAME,
      totalObjects,
      usedBytes:     totalSize,
      usedMB:        parseFloat((totalSize / 1024 / 1024).toFixed(2)),
      usedGB:        parseFloat((totalSize / 1024 / 1024 / 1024).toFixed(3)),
      limitGB:       10,
      usedPct:       parseFloat(usedPct.toFixed(2)),
      status:        usedPct >= 90 ? 'DANGER' : usedPct >= 70 ? 'WARNING' : 'OK',
    });
  } catch (error) {
    res.status(500).json({ message: 'R2 stats failed: ' + error.message });
  }
});

// ==========================================
// 20. MAINTENANCE MODE — GET (developer view)
// ==========================================
// GET /api/developer/maintenance
router.get('/maintenance', async (req, res) => {
  try {
    const m = await MaintenanceMode.findOne().sort({ updatedAt: -1 });
    if (!m) return res.json({ isActive: false, message: '', scheduledStart: null, scheduledEnd: null });
    const now = new Date();
    const scheduledActive = m.scheduledStart && m.scheduledStart <= now && (!m.scheduledEnd || m.scheduledEnd > now);
    res.json({ ...m.toObject(), effectivelyActive: m.isActive || scheduledActive });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 20. MAINTENANCE MODE — SET
// ==========================================
// PATCH /api/developer/maintenance
router.patch('/maintenance', async (req, res) => {
  try {
    const { isActive, message, scheduledStart, scheduledEnd } = req.body;
    let m = await MaintenanceMode.findOne().sort({ updatedAt: -1 });
    if (!m) m = new MaintenanceMode();

    if (isActive !== undefined) {
      m.isActive = !!isActive; // coerce to a real boolean — never store arbitrary input
      if (m.isActive) m.activatedAt = new Date();
    }
    if (message !== undefined) m.message = String(message).slice(0, 500); // cap length
    if (scheduledStart !== undefined) m.scheduledStart = scheduledStart ? new Date(scheduledStart) : null;
    if (scheduledEnd   !== undefined) m.scheduledEnd   = scheduledEnd   ? new Date(scheduledEnd)   : null;
    m.setBy = req.user.userId;
    await m.save();

    const actor = req.user?.email || req.user?.userId || 'Developer';
    if (isActive !== undefined) {
      logEvent('INFO',
        `Maintenance mode ${m.isActive ? 'enabled' : 'disabled'} by ${actor}`,
        { setBy: req.user?.userId, message: m.message || null }
      );
    }
    res.json({ message: `Maintenance mode ${m.isActive ? 'activated' : 'updated'}.`, maintenance: m });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 21. EDIT USER PROFILE (name / email / role)
// ==========================================
// PATCH /api/developer/users/:id/profile
router.patch('/users/:id/profile', async (req, res) => {
  try {
    const { name, email, role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.role === 'SUPER_ADMIN') return res.status(403).json({ message: 'Cannot edit Super Admin.' });

    const ALLOWED_ROLES = ['PROPERTY_OWNER', 'HOTEL_MANAGER', 'DEVELOPER'];
    if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role.' });
    }
    if (name !== undefined) user.name = String(name).trim().slice(0, 100);
    if (email !== undefined) {
      const clean = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
        return res.status(400).json({ message: 'Invalid email format.' });
      }
      const dup = await User.findOne({ email: clean, _id: { $ne: user._id } });
      if (dup) return res.status(409).json({ message: 'Email already in use.' });
      user.email = clean;
    }
    if (role !== undefined) user.role = role;

    const changes = [
      name  !== undefined ? `name → "${user.name}"` : null,
      email !== undefined ? `email → "${user.email}"` : null,
      role  !== undefined ? `role → ${user.role}` : null,
    ].filter(Boolean).join(', ');
    await user.save();
    logEvent('INFO',
      `User profile updated: ${user.email} (${changes}) by ${req.user?.userId}`,
      { targetUserId: user._id }
    );
    res.json({ message: 'User updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 22. DB BROWSER — list documents
// ==========================================
// GET /api/developer/db/browse/:collection
const BROWSABLE = ['users', 'properties', 'bookings', 'logs', 'uploadtokens', 'maintenancemodes'];
const DELETABLE_DB = ['logs', 'uploadtokens'];

router.get('/db/browse/:collection', async (req, res) => {
  try {
    const col = String(req.params.collection).toLowerCase();
    if (!BROWSABLE.includes(col)) {
      return res.status(400).json({ message: 'Collection not available for browsing.' });
    }

    const limit  = clampInt(req.query.limit,  20, 1, 100);
    const offset = clampInt(req.query.offset,   0, 0, 1_000_000);
    const search = req.query.search ? String(req.query.search).trim() : '';

    const collection = mongoose.connection.db.collection(col);
    let query = {};

    if (search) {
      if (/^[a-f\d]{24}$/i.test(search)) {
        query = { _id: new mongoose.Types.ObjectId(search) };
      } else {
        const re = { $regex: escapeRegex(search), $options: 'i' };
        query = {
          $or: [
            { name: re }, { email: re }, { guestName: re },
            { guestEmail: re }, { subject: re }, { route: re }, { message: re }
          ]
        };
      }
    }

    const [documents, total] = await Promise.all([
      collection.find(query).sort({ _id: -1 }).skip(offset).limit(limit).toArray(),
      collection.countDocuments(query)
    ]);

    const safe = documents.map(doc => {
      const d = { ...doc };
      if (d.password)     d.password     = '[HIDDEN]';
      if (d.refreshToken) d.refreshToken = '[HIDDEN]';
      return d;
    });

    res.json({ documents: safe, total, offset, limit });
  } catch (error) {
    console.error('DB browse error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// DELETE /api/developer/db/:collection/:id
router.delete('/db/:collection/:id', async (req, res) => {
  try {
    const col = String(req.params.collection).toLowerCase();
    if (!DELETABLE_DB.includes(col)) {
      return res.status(403).json({ message: 'Deletion not allowed for this collection.' });
    }
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid document ID.' });
    }
    const result = await mongoose.connection.db.collection(col)
      .deleteOne({ _id: new mongoose.Types.ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Document not found.' });
    res.json({ message: 'Document deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ==========================================
// 23. ENV VARIABLES (masked, read-only)
// ==========================================
// GET /api/developer/env
router.get('/env', (req, res) => {
  const MASK    = /secret|key|token|password|uri|auth|private|credential|salt/i;
  const INCLUDE = /^(CF_|JWT|MONGO|FRONTEND|RAZORPAY|SMTP|PORT|NODE_ENV|DB_)/;

  const vars = Object.entries(process.env)
    .filter(([k]) => INCLUDE.test(k))
    .map(([key, val]) => {
      const sensitive = MASK.test(key);
      let display = val || '(not set)';
      if (sensitive && val && val.length > 4) {
        display = val.slice(0, 4) + '*'.repeat(Math.min(val.length - 4, 20));
      }
      return { key, display, isSet: !!val, sensitive };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  res.json({ vars, nodeEnv: process.env.NODE_ENV || 'development' });
});

// ==========================================
// 24. SERVER RESTART (PM2 auto-restarts)
// ==========================================
// POST /api/developer/process/restart
router.post('/process/restart', (req, res) => {
  logEvent('INFO', `Server restart triggered by ${req.user?.email || req.user?.userId || 'Developer'}`);
  res.json({ message: 'Server restarting… reconnect in ~3 seconds.' });
  setTimeout(() => process.exit(0), 400);
});

// ==========================================
// 25. R2 STORAGE — LIST FILES
// ==========================================
// GET /api/developer/storage/files
router.get('/storage/files', async (req, res) => {
  try {
    const { isConfigured } = require('../utils/r2');
    if (!isConfigured()) return res.json({ configured: false, files: [] });

    const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: process.env.CF_R2_ACCESS_KEY_ID, secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY },
    });

    const limit = clampInt(req.query.limit, 50, 1, 200);
    const page = await client.send(new ListObjectsV2Command({
      Bucket: process.env.CF_R2_BUCKET_NAME,
      MaxKeys: limit,
      ContinuationToken: req.query.token || undefined,
    }));

    const publicBase = (process.env.CF_R2_PUBLIC_URL || '').replace(/\/$/, '');
    const keys = (page.Contents || []).map(obj => obj.Key);

    // Fetch all bookings that have a real uploaded document URL, then extract
    // the key via regex — avoids fragile string-based $in matching on publicBase.
    const Booking  = require('../models/Booking');
    const Property = require('../models/Property');
    const bookings = keys.length
      ? await Booking.find({ documentUrl: { $regex: /^https?:\/\// } })
        .select('guestName guestPhone guestEmail property documentUrl _id')
        .populate('property', 'name')
        .lean()
      : [];

    // Build a key → booking map using regex extraction (uploadToR2 always uses properties/ prefix)
    const KEY_RE = /properties\/[^?#\s]+/;
    const byKey = {};
    for (const b of bookings) {
      const m = b.documentUrl && b.documentUrl.match(KEY_RE);
      if (m) byKey[m[0]] = b;
    }

    res.json({
      configured: true,
      files: keys.map(key => {
        const b = byKey[key];
        return {
          key,
          size: page.Contents.find(o => o.Key === key)?.Size,
          lastModified: page.Contents.find(o => o.Key === key)?.LastModified,
          url: publicBase ? `${publicBase}/${key}` : null,
          guest: b ? {
            name:     b.guestName,
            phone:    b.guestPhone,
            email:    b.guestEmail || '',
            hotel:    b.property?.name || '—',
            bookingId: b.bookingId || b._id,
          } : null,
        };
      }),
      nextToken:   page.IsTruncated ? page.NextContinuationToken : null,
      isTruncated: !!page.IsTruncated,
    });
  } catch (error) {
    res.status(500).json({ message: 'R2 listing failed: ' + error.message });
  }
});

// ==========================================
// 26. R2 STORAGE — DELETE FILE
// ==========================================
// DELETE /api/developer/storage/file
router.delete('/storage/file', async (req, res) => {
  try {
    const { isConfigured } = require('../utils/r2');
    if (!isConfigured()) return res.status(400).json({ message: 'R2 not configured.' });

    const key = typeof req.body.key === 'string' ? req.body.key.trim() : '';
    if (!key || key.includes('..') || key.startsWith('/')) {
      return res.status(400).json({ message: 'Invalid file key.' });
    }

    const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: process.env.CF_R2_ACCESS_KEY_ID, secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY },
    });

    await client.send(new DeleteObjectCommand({ Bucket: process.env.CF_R2_BUCKET_NAME, Key: key }));
    res.json({ message: `Deleted "${key}" from R2.` });
  } catch (error) {
    res.status(500).json({ message: 'R2 delete failed: ' + error.message });
  }
});

// ==========================================
// 27. GUEST SEARCH
// ==========================================
// GET /api/developer/guest-search?q=<phone or name>
router.get('/guest-search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 3) {
      return res.status(400).json({ message: 'Query must be at least 3 characters.' });
    }

    const Booking = require('../models/Booking');
    const regex = new RegExp(q, 'i');

    const bookings = await Booking.find({
      $or: [
        { guestPhone: { $regex: regex } },
        { guestName:  { $regex: regex } },
      ]
    })
      .populate('property', 'name')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Group by guestPhone
    const map = new Map();
    for (const b of bookings) {
      const phone = b.guestPhone || '__unknown__';
      if (!map.has(phone)) {
        map.set(phone, []);
      }
      map.get(phone).push(b);
    }

    const results = [];
    for (const [phone, group] of map.entries()) {
      const latest = group[0]; // already sorted by createdAt desc
      const hotels = [...new Set(group.map(b => b.property?.name).filter(Boolean))];
      const nonPendingUrls = group
        .map(b => b.documentUrl)
        .filter(u => u && u !== 'pending_upload' && /^https?:\/\//.test(u));
      const uniqueUrls = [...new Set(nonPendingUrls)];

      results.push({
        guestName:     latest.guestName,
        guestPhone:    phone === '__unknown__' ? null : phone,
        guestEmail:    latest.guestEmail || null,
        totalBookings: group.length,
        hotels,
        latestBooking: {
          _id:      latest._id,
          checkIn:  latest.checkIn,
          checkOut: latest.checkOut,
          status:   latest.status,
          property: latest.property ? { name: latest.property.name } : null,
        },
        documentUrl:  uniqueUrls[0] || null,
        documentUrls: uniqueUrls,
      });
    }

    res.json({ results });
  } catch (error) {
    res.status(500).json({ message: 'Guest search failed: ' + error.message });
  }
});

// --- Helper ---
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

module.exports = router;
