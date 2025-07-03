// src/utils/logger.js - Logging utilities
import { config } from '../config/app.js';

class Logger {
  constructor() {
    this.isDevelopment = config.server.env === 'development';
  }

  info(message, meta = {}) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, 
      this.isDevelopment ? meta : '');
  }

  error(message, error = null, meta = {}) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, 
      error ? error.stack || error : '', 
      this.isDevelopment ? meta : '');
  }

  warn(message, meta = {}) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, 
      this.isDevelopment ? meta : '');
  }

  debug(message, meta = {}) {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta);
    }
  }

  request(req, res, responseTime) {
    this.info(`${req.method} ${req.path} - ${res.statusCode} - ${responseTime}ms`, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
}

export const logger = new Logger();