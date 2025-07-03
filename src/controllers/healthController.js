// src/controllers/healthController.js - Health check
import { DatabaseService } from '../services/databaseService.js';
import { StorageService } from '../services/storageService.js';
import { sendSuccess } from '../utils/response.js';

export class HealthController {
  static async getHealth(req, res) {
    const health = {
      status: 'healthy',
      service: 'privychain-backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      w3up_ready: StorageService.isReady(),
      database_ready: true
    };

    // Test database connection
    const dbHealth = await DatabaseService.healthCheck();
    health.database_status = dbHealth.status;
    
    if (dbHealth.status === 'error') {
      health.status = 'degraded';
    }

    sendSuccess(res, health);
  }

  static async getSystemStatus(req, res) {
    try {
      const systemStatus = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0',
        services: {}
      };

      // Check database
      const dbHealth = await DatabaseService.healthCheck();
      systemStatus.services.database = dbHealth;

      // Check w3up
      systemStatus.services.w3up = { 
        status: StorageService.isReady() ? 'healthy' : 'error'
      };

      sendSuccess(res, systemStatus);
      
    } catch (error) {
      console.error('System status error:', error);
      sendError(res, 500, 'Failed to get system status');
    }
  }
}