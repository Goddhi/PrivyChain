// src/utils/crypto.js - Cryptographic utilities
import crypto from 'crypto';

export function generateRandomBytes(size) {
  return crypto.randomBytes(size);
}

export function generateSecureId() {
  return crypto.randomBytes(16).toString('hex');
}

export function hashSHA256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function createHMAC(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

export function verifyHMAC(key, data, expectedSignature) {
  const signature = createHMAC(key, data);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}