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

    if (type && type !== 'ALL') query.type = type;
    if (method) query.method = method.toUpperCase();
    if (route) query.route = { $regex: route, $options: 'i' };
    if (ip) query.ip = { $regex: ip };
    if (userId) query.userId = userId;

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

    const [logs, total] = await Promise.all([
      Log.find(query)
        .sort({ createdAt: -1 })
        .skip(Number(offset))
        .limit(Math.min(Number(limit), 200))
        .lean(),
      Log.countDocuments(query)
    ]);

    res.json({ logs, total, offset: Number(offset), limit: Number(limit) });
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
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - Number(hours) * 60 * 60 * 1000);

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
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - Number(hours) * 60 * 60 * 1000);

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
    const { hours = 1 } = req.query;
    const since = new Date(Date.now() - Number(hours) * 60 * 60 * 1000);

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
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ message: 'IP address is required.' });
  resetIP(ip);
  res.json({ message: `Rate limit cleared for ${ip}. They can now make requests immediately.` });
});

// ==========================================
// 8. CLEAR OLD LOGS (manual cleanup)
// ==========================================
// DELETE /api/developer/logs/purge?days=30
router.delete('/logs/purge', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const cutoff = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
    const result = await Log.deleteMany({ createdAt: { $lt: cutoff } });
    res.json({ message: `Deleted ${result.deletedCount} log entries older than ${days} days.` });
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
// 19. MAINTENANCE MODE — GET (developer view)
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
      m.isActive = isActive;
      if (isActive) m.activatedAt = new Date();
    }
    if (message !== undefined) m.message = message;
    if (scheduledStart !== undefined) m.scheduledStart = scheduledStart ? new Date(scheduledStart) : null;
    if (scheduledEnd   !== undefined) m.scheduledEnd   = scheduledEnd   ? new Date(scheduledEnd)   : null;
    m.setBy = req.user.userId;
    await m.save();

    res.json({ message: `Maintenance mode ${m.isActive ? 'activated' : 'updated'}.`, maintenance: m });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
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
