// src/middleware/validation.js - Input validation
import { sendError } from '../utils/response.js';

export function validateJSON(req, res, next) {
  if (req.method === 'POST' && req.headers['content-type']?.includes('application/json')) {
    if (!req.body || typeof req.body !== 'object') {
      return sendError(res, 400, 'Invalid JSON request body');
    }
  }
  next();
}

export function validateFileUpload(req, res, next) {
  const { file, file_name } = req.body;
  
  if (!file) {
    return sendError(res, 400, 'File is required');
  }
  
  if (!file_name) {
    return sendError(res, 400, 'File name is required');
  }
  
  // Check file size (base64 encoded)
  try {
    const fileSize = Buffer.from(file, 'base64').length;
    const maxSize = 100 * 1024 * 1024 * 1024; // 100GB
    
    if (fileSize > maxSize) {
      return sendError(res, 413, 'File too large');
    }
  } catch (error) {
    return sendError(res, 400, 'Invalid file data');
  }
  
  next();
}

export function sanitizeFileName(req, res, next) {
  if (req.body?.file_name) {
    // Remove dangerous characters
    let sanitized = req.body.file_name.replace(/[/\\:*?"<>|]/g, '_');
    
    // Limit length
    if (sanitized.length > 255) {
      sanitized = sanitized.substring(0, 255);
    }
    
    req.body.file_name = sanitized;
  }
  
  next();
}