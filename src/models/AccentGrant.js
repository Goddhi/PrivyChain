// src/models/AccessGrant.js - Access grant model
import { getDatabase } from '../config/database.js';

export class AccessGrant {
  static async create(data) {
    const db = getDatabase();
    const result = await db.run(`
      INSERT INTO access_grants (cid, granter_addr, grantee_addr, expires_at, is_active)
      VALUES (?, ?, ?, ?, ?)
    `, [
      data.cid,
      data.granter_addr,
      data.grantee_addr,
      data.expires_at,
      data.is_active !== false ? 1 : 0
    ]);
    return result.lastID;
  }

  static async findActiveGrant(cid, granteeAddr) {
    const db = getDatabase();
    return await db.get(`
      SELECT * FROM access_grants 
      WHERE cid = ? AND grantee_addr = ? AND is_active = 1 
      AND (expires_at IS NULL OR expires_at > datetime('now'))
    `, [cid, granteeAddr]);
  }

  static async revokeAccess(cid, granterAddr, granteeAddr) {
    const db = getDatabase();
    return await db.run(
      'UPDATE access_grants SET is_active = 0 WHERE cid = ? AND granter_addr = ? AND grantee_addr = ?',
      [cid, granterAddr, granteeAddr]
    );
  }

  static async hasAccess(cid, userAddress) {
    const db = getDatabase();
    
    // Check if user is the uploader
    const fileRecord = await db.get(
      'SELECT * FROM file_records WHERE cid = ? AND uploader_addr = ?',
      [cid, userAddress]
    );
    
    if (fileRecord) return true;
    
    // Check access grants
    const grant = await db.get(`
      SELECT * FROM access_grants 
      WHERE cid = ? AND grantee_addr = ? AND is_active = 1 
      AND (expires_at IS NULL OR expires_at > datetime('now'))
    `, [cid, userAddress]);
    
    return !!grant;
  }
}