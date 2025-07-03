// scripts/cleanup-db.js - Database cleanup script
import { DatabaseManager } from './db-utils.js';

async function cleanupDatabase() {
    const dbManager = new DatabaseManager();
    
    try {
        console.log('🧹 Starting database cleanup...');
        const results = await dbManager.cleanup({ days: 30 });
        
        console.log('✅ Cleanup completed:');
        console.log(`   Expired grants removed: ${results.expired_grants_deleted}`);
        
        if (results.expired_grants_deleted > 0) {
            console.log('💡 Database has been optimized');
        } else {
            console.log('💡 No cleanup needed');
        }
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
        process.exit(1);
    } finally {
        await dbManager.close();
    }
}

cleanupDatabase();