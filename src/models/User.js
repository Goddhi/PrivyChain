// src/models/User.js - User model
import { getDatabase } from '../config/database.js';

export class User {
  static async getStats(userAddress) {
    const db = getDatabase();
    
    return await db.get(`
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size) as total_size,
        SUM(CASE WHEN is_encrypted = 1 THEN 1 ELSE 0 END) as encrypted_files
      FROM file_records 
      WHERE uploader_addr = ?
    `, [userAddress]);
  }

  static async getFiles(userAddress, options = {}) {
    const db = getDatabase();
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;
    
    const files = await db.all(`
      SELECT * FROM file_records 
      WHERE uploader_addr = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [userAddress, limit, offset]);
    
    const total = await db.get(
      'SELECT COUNT(*) as count FROM file_records WHERE uploader_addr = ?',
      [userAddress]
    );
    
    return {
      files,
      pagination: {
        page,
        limit,
        total: total.count,
        total_pages: Math.ceil(total.count / limit)
      }
    };
  }

  static async isValidAddress(address) {
    return address && address.length === 42 && address.startsWith('0x');
  }
}