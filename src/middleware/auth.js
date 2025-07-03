// src/middleware/auth.js - Authentication middleware
import { AuthService } from '../services/authService.js';
import { sendError } from '../utils/response.js';

export function requireAuth(req, res, next) {
  const userAddress = req.headers['x-user-address'] || req.body?.user_address;
  const signature = req.headers['x-signature'] || req.body?.signature;
  
  if (!userAddress || !signature) {
    return sendError(res, 401, 'Authentication required');
  }
  
  if (!AuthService.isValidAddress(userAddress)) {
    return sendError(res, 400, 'Invalid user address');
  }
  
  if (!AuthService.isValidSignatureFormat(signature)) {
    return sendError(res, 400, 'Invalid signature format');
  }
  
  req.user = {
    address: userAddress,
    signature: signature
  };
  
  next();
}

export function optionalAuth(req, res, next) {
  const userAddress = req.headers['x-user-address'] || req.body?.user_address;
  const signature = req.headers['x-signature'] || req.body?.signature;
  
  if (userAddress && signature) {
    if (AuthService.isValidAddress(userAddress) && AuthService.isValidSignatureFormat(signature)) {
      req.user = {
        address: userAddress,
        signature: signature
      };
    }
  }
  
  next();
}