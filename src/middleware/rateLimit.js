// src/middleware/rateLimit.js - Rate limiting
import rateLimit from 'express-rate-limit';
import { config } from '../config/app.js';

export const generalRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: { 
    success: false, 
    error: 'Too many requests, please try again later' 
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 uploads per minute
  message: { 
    success: false, 
    error: 'Upload rate limit exceeded. Please wait before uploading again.' 
  }
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 auth attempts per 15 minutes
  message: { 
    success: false, 
    error: 'Too many authentication attempts. Please try again later.' 
  }
});