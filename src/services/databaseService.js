// src/services/databaseService.js - Database operations service
import { getDatabase } from '../config/database.js';

export class DatabaseService {
  static async getStats() {
    const db = getDatabase();
    
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_files,
        COUNT(DISTINCT uploader_addr) as total_users,
        SUM(file_size) as total_storage,
        SUM(CASE WHEN is_encrypted = 1 THEN 1 ELSE 0 END) as encrypted_files
      FROM file_records
    `);

    return {
      total_files: stats.total_files || 0,
      total_users: stats.total_users || 0,
      total_storage_bytes: stats.total_storage || 0,
      encrypted_files: stats.encrypted_files || 0
    };
  }

  static async getRecentActivity(days = 7) {
    const db = getDatabase();
    
    return await db.all(`
      SELECT DATE(created_at) as date, COUNT(*) as uploads
      FROM file_records 
      WHERE created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [days]);
  }

  static async cleanup(days = 30) {
    const db = getDatabase();
    
    // Clean up expired access grants
    const result = await db.run(`
      DELETE FROM access_grants 
      WHERE expires_at < datetime('now') 
      AND expires_at != '2099-12-31T00:00:00.000Z'
    `);

    // Vacuum database
    await db.run('VACUUM');

    return {
      expired_grants_deleted: result.changes || 0
    };
  }

  static async healthCheck() {
    const db = getDatabase();
    
    try {
      await db.get('SELECT 1');
      return { status: 'healthy' };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }
}