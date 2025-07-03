// src/controllers/analyticsController.js - Analytics endpoints
import { DatabaseService } from '../services/databaseService.js';
import { ApiUsage } from '../models/ApiUsage.js';
import { sendSuccess, sendError } from '../utils/response.js';

export class AnalyticsController {
  static async getOverview(req, res) {
    try {
      const overview = await DatabaseService.getStats();
      const recentActivity = await DatabaseService.getRecentActivity(30);
      
      sendSuccess(res, {
        overview,
        recent_activity: recentActivity
      });
      
    } catch (error) {
      console.error('Analytics error:', error);
      sendError(res, 500, 'Failed to get analytics');
    }
  }

  static async getPerformance(req, res) {
    try {
      const hours = parseInt(req.query.hours) || 24;
      const performance = await ApiUsage.getStats(hours);
      
      sendSuccess(res, {
        endpoints: performance
      });
      
    } catch (error) {
      console.error('Performance analytics error:', error);
      sendError(res, 500, 'Failed to get performance metrics');
    }
  }

  static async getSystemMetrics(req, res) {
    try {
      const metrics = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };
      
      sendSuccess(res, metrics);
      
    } catch (error) {
      console.error('System metrics error:', error);
      sendError(res, 500, 'Failed to get system metrics');
    }
  }
}