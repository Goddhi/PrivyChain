// src/routes/analytics.js - Analytics routes
import express from 'express';
import { AnalyticsController } from '../controllers/analyticsController.js';

const router = express.Router();

// Analytics endpoints
router.get('/overview', AnalyticsController.getOverview);
router.get('/performance', AnalyticsController.getPerformance);
router.get('/system', AnalyticsController.getSystemMetrics);

export default router;