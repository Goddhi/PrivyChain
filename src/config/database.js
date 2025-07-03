// src/config/database.js - Database configuration
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { config } from './app.js';

let db = null;

export async function initDatabase() {
  if (db) return db;

  db = await open({
    filename: config.database.path,
    driver: sqlite3.Database
  });

  await createTables();
  return db;
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

async function createTables() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS file_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cid TEXT UNIQUE NOT NULL,
      uploader_addr TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      is_encrypted BOOLEAN NOT NULL DEFAULT 0,
      file_name TEXT NOT NULL,
      content_type TEXT,
      metadata TEXT,
      tx_hash TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS access_grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cid TEXT NOT NULL,
      granter_addr TEXT NOT NULL,
      grantee_addr TEXT NOT NULL,
      expires_at DATETIME,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS encryption_keys (
      user_address TEXT PRIMARY KEY,
      public_key TEXT NOT NULL,
      key_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_file_records_uploader ON file_records(uploader_addr);
    CREATE INDEX IF NOT EXISTS idx_access_grants_cid ON access_grants(cid);
    CREATE INDEX IF NOT EXISTS idx_access_grants_grantee ON access_grants(grantee_addr);
  `);
}

export async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
  }
}