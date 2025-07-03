// src/utils/validation.js - Validation helpers
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  export function isValidURL(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  export function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    
    return str
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/[^\w\s.-]/g, '') // Keep only safe characters
      .trim()
      .slice(0, 1000); // Limit length
  }
  
  export function validateFileSize(size, maxSize = 100 * 1024 * 1024 * 1024) {
    return size > 0 && size <= maxSize;
  }
  
  export function validateCID(cid) {
    // Basic CID validation (simplified)
    return cid && typeof cid === 'string' && cid.length > 10;
  }