// src/models/FileRecord.js - File record model
import { getDatabase } from '../config/database.js';

export class FileRecord {
  static async create(data) {
    const db = getDatabase();
    const result = await db.run(`
      INSERT INTO file_records 
      (cid, uploader_addr, file_size, is_encrypted, file_name, content_type, metadata, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.cid,
      data.uploader_addr,
      data.file_size,
      data.is_encrypted ? 1 : 0,
      data.file_name,
      data.content_type || null,
      JSON.stringify(data.metadata || {}),
      data.status || 'pending'
    ]);
    return result.lastID;
  }

  static async findByCid(cid) {
    const db = getDatabase();
    return await db.get('SELECT * FROM file_records WHERE cid = ?', [cid]);
  }

  static async findByUploader(uploaderAddr, options = {}) {
    const db = getDatabase();
    const { limit = 20, offset = 0 } = options;
    
    return await db.all(`
      SELECT * FROM file_records 
      WHERE uploader_addr = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [uploaderAddr, limit, offset]);
  }

  static async updateStatus(cid, status) {
    const db = getDatabase();
    return await db.run(
      'UPDATE file_records SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE cid = ?',
      [status, cid]
    );
  }

  static async getStats(uploaderAddr) {
    const db = getDatabase();
    return await db.get(`
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size) as total_size,
        SUM(CASE WHEN is_encrypted = 1 THEN 1 ELSE 0 END) as encrypted_files
      FROM file_records 
      WHERE uploader_addr = ?
    `, [uploaderAddr]);
  }
}