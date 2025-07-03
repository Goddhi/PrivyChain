// src/routes/index.js - Route aggregator
import express from 'express';
import { HealthController } from '../controllers/healthController.js';
import filesRoutes from './files.js';
import usersRoutes from './users.js';
import analyticsRoutes from './analytics.js';
import adminRoutes from './admin.js';

const router = express.Router();

// Health routes
router.get('/health', HealthController.getHealth);
router.get('/system/status', HealthController.getSystemStatus);

// Feature routes
router.use('/', filesRoutes);
router.use('/users', usersRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/admin', adminRoutes);

// 404 handler for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    available_endpoints: [
      'GET /api/v1/health',
      'POST /api/v1/upload',
      'POST /api/v1/retrieve',
      'POST /api/v1/access/grant',
      'POST /api/v1/access/revoke',
      'GET /api/v1/users/:address/stats',
      'GET /api/v1/users/:address/files',
      'GET /api/v1/analytics/overview'
    ]
  });
});

export default router;