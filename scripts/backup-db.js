// scripts/backup-db.js - Simple database backup script
import { DatabaseManager } from './db-utils.js';

async function createBackup() {
    const dbManager = new DatabaseManager();
    
    try {
        console.log('🔄 Creating database backup...');
        const backupPath = await dbManager.backup();
        console.log(`✅ Backup completed: ${backupPath}`);
    } catch (error) {
        console.error('❌ Backup failed:', error.message);
        process.exit(1);
    } finally {
        await dbManager.close();
    }
}

createBackup();


