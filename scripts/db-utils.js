// scripts/db-utils.js - Database management utilities
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DATABASE_PATH || './privychain.db';

class DatabaseManager {
    constructor() {
        this.db = null;
    }

    async connect() {
        if (this.db) return this.db;
        
        this.db = await open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });
        
        return this.db;
    }

    async close() {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }

    async backup(backupPath = null) {
        if (!backupPath) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            backupPath = `./backups/privychain-backup-${timestamp}.db`;
        }

        // Ensure backup directory exists
        const backupDir = path.dirname(backupPath);
        await fs.mkdir(backupDir, { recursive: true });

        // Copy database file
        await fs.copyFile(DB_PATH, backupPath);
        
        console.log(`✅ Database backed up to: ${backupPath}`);
        return backupPath;
    }

    async getStats() {
        const db = await this.connect();
        
        const stats = {
            tables: {},
            total_size: 0,
            file_size: 0
        };

        // Get file size
        try {
            const fileStats = await fs.stat(DB_PATH);
            stats.file_size = fileStats.size;
        } catch (error) {
            stats.file_size = 0;
        }

        // Get table statistics
        const tables = await db.all(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `);

        for (const table of tables) {
            const count = await db.get(`SELECT COUNT(*) as count FROM ${table.name}`);
            stats.tables[table.name] = count.count;
            stats.total_size += count.count;
        }

        return stats;
    }

    async cleanup(options = {}) {
        const db = await this.connect();
        const { days = 30 } = options;

        const results = {
            expired_grants_deleted: 0
        };

        // Clean up expired access grants
        const grantsResult = await db.run(`
            DELETE FROM access_grants 
            WHERE expires_at < datetime('now') 
            AND expires_at != '2099-12-31T00:00:00.000Z'
        `);
        results.expired_grants_deleted = grantsResult.changes || 0;
        console.log(`🧹 Deleted ${results.expired_grants_deleted} expired access grants`);

        // Vacuum database to reclaim space
        console.log('🔧 Optimizing database...');
        await db.run('VACUUM');

        return results;
    }
}

// CLI interface
async function main() {
    const command = process.argv[2];
    const dbManager = new DatabaseManager();

    try {
        switch (command) {
            case 'stats':
                console.log('📊 Database Statistics');
                console.log('======================');
                const stats = await dbManager.getStats();
                console.log(`File size: ${(stats.file_size / 1024 / 1024).toFixed(2)} MB`);
                console.log('Tables:');
                for (const [table, count] of Object.entries(stats.tables)) {
                    console.log(`  ${table}: ${count} records`);
                }
                break;

            case 'backup':
                const backupPath = process.argv[3];
                await dbManager.backup(backupPath);
                break;

            case 'cleanup':
                const days = parseInt(process.argv[3]) || 30;
                console.log(`🧹 Cleaning up data older than ${days} days...`);
                const results = await dbManager.cleanup({ days });
                console.log('Cleanup results:', results);
                break;

            default:
                console.log('PrivyChain Database Utilities');
                console.log('=============================');
                console.log('');
                console.log('Usage: node scripts/db-utils.js <command> [options]');
                console.log('');
                console.log('Commands:');
                console.log('  stats                    Show database statistics');
                console.log('  backup [path]           Create database backup');
                console.log('  cleanup [days]          Clean up old data (default: 30 days)');
                console.log('');
                console.log('Examples:');
                console.log('  node scripts/db-utils.js stats');
                console.log('  node scripts/db-utils.js backup ./my-backup.db');
                console.log('  node scripts/db-utils.js cleanup 7');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await dbManager.close();
    }
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { DatabaseManager };