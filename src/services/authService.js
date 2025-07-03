// src/services/authService.js - Authentication & signature verification service
import { ethers } from 'ethers';
import { config } from '../config/app.js';

export class AuthService {
  static verifySignature(address, signature, message) {
    // Skip verification in development
    if (config.security.skipSignatureVerification) {
      console.log('⚠️  Signature verification bypassed for development');
      return this.isValidSignatureFormat(signature);
    }
    
    try {
      const recoveredAddress = ethers.utils.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }
  
  static isValidSignatureFormat(signature) {
    return signature && 
           signature.startsWith('0x') && 
           signature.length === 132; // 0x + 130 hex chars
  }

  static isValidAddress(address) {
    return ethers.utils.isAddress(address);
  }

  static createAuthMessage(nonce = '', timestamp = '') {
    return `PrivyChain Authentication\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
  }

  static validateRequest(req) {
    const errors = [];
    
    if (!req.user_address) {
      errors.push({ field: 'user_address', message: 'User address is required' });
    } else if (!this.isValidAddress(req.user_address)) {
      errors.push({ field: 'user_address', message: 'Invalid Ethereum address' });
    }
    
    if (!req.signature) {
      errors.push({ field: 'signature', message: 'Signature is required' });
    } else if (!this.isValidSignatureFormat(req.signature)) {
      errors.push({ field: 'signature', message: 'Invalid signature format' });
    }
    
    return errors;
  }
}