// src/utils/response.js - Response formatting
export function sendSuccess(res, data, message = null) {
    res.json({
      success: true,
      data,
      ...(message && { message })
    });
  }
  
  export function sendError(res, statusCode, error, details = null) {
    res.status(statusCode).json({
      success: false,
      error,
      ...(details && { details })
    });
  }
  
  export function sendValidationError(res, validationErrors) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      validation_errors: validationErrors
    });
  }
  
  export function sendNotFound(res, resource = 'Resource') {
    res.status(404).json({
      success: false,
      error: `${resource} not found`
    });
  }
  
  export function sendUnauthorized(res, message = 'Unauthorized') {
    res.status(401).json({
      success: false,
      error: message
    });
  }
  
  export function sendForbidden(res, message = 'Forbidden') {
    res.status(403).json({
      success: false,
      error: message
    });
  }