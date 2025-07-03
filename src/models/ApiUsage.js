// src/models/ApiUsage.js - API usage tracking model
import { getDatabase } from '../config/database.js';

export class ApiUsage {
  static async log(data) {
    const db = getDatabase();
    
    // Only log if table exists (optional feature)
    try {
      await db.run(`
        INSERT INTO api_usage 
        (user_address, endpoint, method, status_code, response_time, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        data.user_address || null,
        data.endpoint,
        data.method,
        data.status_code,
        data.response_time,
        data.ip_address,
        data.user_agent || null
      ]);
    } catch (error) {
      // Silently fail if api_usage table doesn't exist
      console.debug('API usage logging failed:', error.message);
    }
  }

  static async getStats(hours = 24) {
    const db = getDatabase();
    
    try {
      return await db.all(`
        SELECT 
          endpoint,
          COUNT(*) as request_count,
          AVG(response_time) as avg_response_time
        FROM api_usage 
        WHERE created_at >= datetime('now', '-' || ? || ' hours')
        GROUP BY endpoint
        ORDER BY request_count DESC
      `, [hours]);
    } catch (error) {
      return [];
    }
  }
}