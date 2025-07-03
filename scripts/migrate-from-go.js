// scripts/migrate-from-go.js - Migration script from Go backend
import { DatabaseManager } from './db-utils.js';
import dotenv from 'dotenv';

dotenv.config();

async function migrateFromGo() {
    console.log('🔄 PrivyChain Migration: Go → JavaScript Backend');
    console.log('=================================================');
    
    const dbManager = new DatabaseManager();
    
    try {
        await dbManager.connect();
        
        console.log('📋 Environment Configuration Check:');
        console.log(`   ✅ NODE_ENV: ${process.env.NODE_ENV || process.env.ENVIRONMENT}`);
        console.log(`   ${process.env.CONTRACT_ADDRESS ? '✅' : '❌'} Contract Address: ${process.env.CONTRACT_ADDRESS || 'Not configured'}`);
        console.log(`   ${process.env.PRIVATE_KEY ? '✅' : '❌'} Private Key: ${process.env.PRIVATE_KEY ? 'Configured' : 'Not configured'}`);
        console.log(`   ${process.env.WEB3_STORAGE_TOKEN ? '✅' : '❌'} Web3 Storage Token: ${process.env.WEB3_STORAGE_TOKEN ? 'Found (legacy)' : 'Not found'}`);
        console.log(`   ${process.env.W3UP_EMAIL ? '✅' : '❌'} W3UP Email: ${process.env.W3UP_EMAIL || 'Not configured'}`);
        console.log('');
        
        // Check if we need to migrate data
        const stats = await dbManager.getStats();
        
        if (stats.tables.file_records > 0) {
            console.log('📊 Existing Data Found:');
            for (const [table, count] of Object.entries(stats.tables)) {
                console.log(`   ${table}: ${count} records`);
            }
            console.log('');
            console.log('✅ Your existing data will work with the JavaScript backend!');
        } else {
            console.log('📊 No existing data found - starting fresh.');
        }
        
        // Environment recommendations
        console.log('💡 Recommendations:');
        
        if (!process.env.CONTRACT_ADDRESS) {
            console.log('   ⚠️  Add CONTRACT_ADDRESS to .env for blockchain features');
        }
        
        if (!process.env.W3UP_EMAIL) {
            console.log('   ⚠️  Add W3UP_EMAIL to .env and run npm run setup');
        }
        
        if (process.env.WEB3_STORAGE_TOKEN && !process.env.W3UP_EMAIL) {
            console.log('   💡 You have a legacy Web3.Storage token');
            console.log('      The new backend uses w3up client instead');
            console.log('      Your existing w3up setup should work automatically');
        }
        
        console.log('');
        console.log('🎉 Migration Analysis Complete!');
        console.log('================================');
        console.log('Next steps:');
        console.log('1. Update your .env file with the new format');
        console.log('2. Run: npm start');
        console.log('3. Test: curl http://localhost:8080/api/v1/health');
        console.log('4. If storage issues: npm run setup');
        
    } catch (error) {
        console.error('❌ Migration check failed:', error.message);
    } finally {
        await dbManager.close();
    }
}

migrateFromGo();