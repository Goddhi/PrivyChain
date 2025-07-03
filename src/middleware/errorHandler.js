// src/middleware/errorHandler.js - Error handling
import { config } from '../config/app.js';

export function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);
  
  // Don't send error details in production
  const isDevelopment = config.server.env === 'development';
  
  // Default error
  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';
  
  // Handle specific error types
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'File too large';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON';
  } else if (err.code === 'ENOTFOUND') {
    statusCode = 503;
    message = 'Service unavailable';
  }
  
  const response = {
    success: false,
    error: message,
    ...(isDevelopment && { 
      details: err.stack,
      timestamp: new Date().toISOString()
    })
  };
  
  res.status(statusCode).json(response);
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
}