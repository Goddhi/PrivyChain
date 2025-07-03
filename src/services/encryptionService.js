// src/services/encryptionService.js - File encryption/decryption service
import crypto from 'crypto';
import { getDatabase } from '../config/database.js';

export class EncryptionService {
  static generateKey() {
    return crypto.randomBytes(32); // AES-256 key
  }

  static encrypt(data, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', key);
    cipher.setAAD(Buffer.from('privychain', 'utf8'));
    
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
  }

  static decrypt(encryptedData, key) {
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);
    
    const decipher = crypto.createDecipher('aes-256-gcm', key);
    decipher.setAAD(Buffer.from('privychain', 'utf8'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
  }

  static async getUserKey(userAddress) {
    const db = getDatabase();
    
    // Get or create user encryption key
    let keyRecord = await db.get(
      'SELECT * FROM encryption_keys WHERE user_address = ?',
      [userAddress]
    );
    
    if (!keyRecord) {
      // Generate new key
      const key = this.generateKey();
      await db.run(
        'INSERT INTO encryption_keys (user_address, public_key, key_id) VALUES (?, ?, ?)',
        [userAddress, key.toString('hex'), `key_${Date.now()}`]
      );
      return key;
    }
    
    return Buffer.from(keyRecord.public_key, 'hex');
  }

  static async encryptFile(fileData, userAddress) {
    const userKey = await this.getUserKey(userAddress);
    return this.encrypt(fileData, userKey);
  }

  static async decryptFile(encryptedData, userAddress) {
    const userKey = await this.getUserKey(userAddress);
    return this.decrypt(encryptedData, userKey);
  }
}