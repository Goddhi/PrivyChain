// server.js - Main PrivyChain backend (updated for existing env compatibility)
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { create } from '@web3-storage/w3up-client';
import { ethers } from 'ethers';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
}));

// Global state
let w3upClient = null;
let db = null;

// Initialize database
async function initializeDatabase() {
    console.log('📊 Initializing database...');
    
    // Use SQLite for JS backend, but support PostgreSQL URL if needed
    const dbPath = process.env.DATABASE_PATH || './privychain.db';
    
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // Create tables
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
    `);

    console.log('✅ Database initialized');
}

// Initialize Web3.Storage w3up client (compatible with existing setup)
async function initializeW3up() {
    console.log('🔧 Initializing Web3.Storage w3up client...');
    
    try {
        w3upClient = await create();
        
        // Check if already logged in (from previous setup)
        const accounts = w3upClient.accounts();
        if (Object.keys(accounts).length === 0) {
            console.log('⚠️  No w3up account found.');
            
            // Provide guidance based on available config
            if (process.env.WEB3_STORAGE_TOKEN) {
                console.log('💡 Found WEB3_STORAGE_TOKEN in your config.');
                console.log('💡 This JS backend uses w3up client instead of the legacy token.');
                console.log('💡 Your existing w3up configuration should work automatically.');
            }
            console.log('💡 If needed, run: npm run setup');
            return false;
        }
        
        // Check current space
        const currentSpace = w3upClient.currentSpace();
        if (!currentSpace) {
            // Try to use an existing space
            const spaces = Object.values(w3upClient.spaces());
            if (spaces.length > 0) {
                await w3upClient.setCurrentSpace(spaces[0].did());
                console.log(`✅ Using existing space: ${spaces[0].did()}`);
            } else {
                console.log('⚠️  No current space set. Run: npm run setup');
                return false;
            }
        } else {
            console.log(`✅ Using space: ${currentSpace.did()}`);
        }
        
        console.log('✅ w3up client ready!');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize w3up:', error.message);
        console.log('💡 Run: npm run setup if you need to reconfigure');
        return false;
    }
}

// Encryption utilities
class EncryptionService {
    static generateKey() {
        return crypto.randomBytes(32); // AES-256 key
    }

    static encrypt(data, key) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-gcm', key);
        cipher.setAAD(Buffer.from('privychain', 'utf8'));
        
        let encrypted = cipher.update(data);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, encrypted]);
    }

    static decrypt(encryptedData, key) {
        const iv = encryptedData.slice(0, 16);
        const authTag = encryptedData.slice(16, 32);
        const encrypted = encryptedData.slice(32);
        
        const decipher = crypto.createDecipher('aes-256-gcm', key);
        decipher.setAAD(Buffer.from('privychain', 'utf8'));
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted;
    }

    static async getUserKey(userAddress) {
        // Get or create user encryption key
        let keyRecord = await db.get(
            'SELECT * FROM encryption_keys WHERE user_address = ?',
            [userAddress]
        );
        
        if (!keyRecord) {
            // Generate new key
            const key = this.generateKey();
            await db.run(
                'INSERT INTO encryption_keys (user_address, public_key, key_id) VALUES (?, ?, ?)',
                [userAddress, key.toString('hex'), `key_${Date.now()}`]
            );
            return key;
        }
        
        return Buffer.from(keyRecord.public_key, 'hex');
    }
}

// Authentication utilities (compatible with existing setup)
class AuthService {
    static verifySignature(address, signature, message) {
        // Skip verification in development
        if (process.env.SKIP_SIGNATURE_VERIFICATION === 'true') {
            console.log('⚠️  Signature verification bypassed for development');
            return this.isValidSignatureFormat(signature);
        }
        
        try {
            const recoveredAddress = ethers.utils.verifyMessage(message, signature);
            return recoveredAddress.toLowerCase() === address.toLowerCase();
        } catch (error) {
            console.error('Signature verification failed:', error);
            return false;
        }
    }
    
    static isValidSignatureFormat(signature) {
        return signature && 
               signature.startsWith('0x') && 
               signature.length === 132; // 0x + 130 hex chars
    }
}

// API Routes

// Health check (enhanced with environment info)
app.get('/api/v1/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            service: 'privychain-backend',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            w3up_ready: w3upClient !== null,
            database_ready: db !== null,
            environment: {
                node_env: process.env.NODE_ENV || process.env.ENVIRONMENT,
                has_web3_token: !!process.env.WEB3_STORAGE_TOKEN,
                has_contract: !!process.env.CONTRACT_ADDRESS,
                has_private_key: !!process.env.PRIVATE_KEY,
                skip_signature_verification: process.env.SKIP_SIGNATURE_VERIFICATION === 'true'
            }
        }
    });
});

// File upload (unchanged but with better error messages)
app.post('/api/v1/upload', async (req, res) => {
    try {
        const { file, file_name, content_type, should_encrypt, metadata, user_address, signature } = req.body;
        
        // Validation
        if (!file || !file_name || !user_address || !signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        // Check if storage is ready
        if (!w3upClient) {
            return res.status(503).json({
                success: false,
                error: 'Storage service not available. Please check Web3.Storage configuration.'
            });
        }
        
        // Verify signature
        if (!AuthService.verifySignature(user_address, signature, file)) {
            return res.status(401).json({
                success: false,
                error: 'Invalid signature'
            });
        }
        
        console.log(`🔄 Processing upload: ${file_name} for ${user_address}`);
        
        // Convert base64 to buffer
        const fileBuffer = Buffer.from(file, 'base64');
        
        // Encrypt if requested
        let fileToUpload = fileBuffer;
        if (should_encrypt) {
            console.log('🔐 Encrypting file...');
            const userKey = await EncryptionService.getUserKey(user_address);
            fileToUpload = EncryptionService.encrypt(fileBuffer, userKey);
        }
        
        // Upload to Web3.Storage
        console.log('📤 Uploading to Web3.Storage...');
        const fileObj = new File([fileToUpload], file_name, { 
            type: content_type || 'application/octet-stream' 
        });
        
        const cid = await w3upClient.uploadFile(fileObj);
        console.log(`✅ Upload successful! CID: ${cid}`);
        
        // Store in database
        await db.run(`
            INSERT INTO file_records 
            (cid, uploader_addr, file_size, is_encrypted, file_name, content_type, metadata, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            cid.toString(),
            user_address,
            fileBuffer.length,
            should_encrypt ? 1 : 0,
            file_name,
            content_type,
            JSON.stringify(metadata || {}),
            'confirmed'
        ]);
        
        res.json({
            success: true,
            data: {
                cid: cid.toString(),
                file_size: fileBuffer.length,
                is_encrypted: should_encrypt,
                status: 'confirmed',
                gateway_url: `https://w3s.link/ipfs/${cid}`
            }
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Storage upload failed',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// [Rest of the API routes remain the same as in the original server.js]
// File retrieval
app.post('/api/v1/retrieve', async (req, res) => {
    try {
        const { cid, user_address, signature } = req.body;
        
        // Validation
        if (!cid || !user_address || !signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        // Verify signature
        if (!AuthService.verifySignature(user_address, signature, cid)) {
            return res.status(401).json({
                success: false,
                error: 'Invalid signature'
            });
        }
        
        // Get file record
        const fileRecord = await db.get(
            'SELECT * FROM file_records WHERE cid = ?',
            [cid]
        );
        
        if (!fileRecord) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }
        
        // Check access permissions
        const hasAccess = await checkFileAccess(cid, user_address);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        
        // Retrieve from Web3.Storage
        console.log(`🔄 Retrieving file: ${cid}`);
        const response = await fetch(`https://w3s.link/ipfs/${cid}`);
        
        if (!response.ok) {
            throw new Error(`Failed to retrieve file: ${response.status}`);
        }
        
        let fileData = await response.arrayBuffer();
        
        // Decrypt if necessary
        if (fileRecord.is_encrypted) {
            console.log('🔓 Decrypting file...');
            const userKey = await EncryptionService.getUserKey(user_address);
            fileData = EncryptionService.decrypt(Buffer.from(fileData), userKey);
        }
        
        res.json({
            success: true,
            data: {
                file: Buffer.from(fileData).toString('base64'),
                file_name: fileRecord.file_name,
                content_type: fileRecord.content_type,
                metadata: fileRecord.metadata
            }
        });
        
    } catch (error) {
        console.error('Retrieve error:', error);
        res.status(500).json({
            success: false,
            error: 'File retrieval failed'
        });
    }
});

// Grant access
app.post('/api/v1/access/grant', async (req, res) => {
    try {
        const { cid, grantee, duration, granter, signature } = req.body;
        
        // Validation
        if (!cid || !grantee || !granter || !signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        // Verify signature
        if (!AuthService.verifySignature(granter, signature, cid + grantee)) {
            return res.status(401).json({
                success: false,
                error: 'Invalid signature'
            });
        }
        
        // Check if granter owns the file
        const fileRecord = await db.get(
            'SELECT * FROM file_records WHERE cid = ? AND uploader_addr = ?',
            [cid, granter]
        );
        
        if (!fileRecord) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to grant access'
            });
        }
        
        // Create access grant
        const expiresAt = duration ? 
            new Date(Date.now() + duration * 1000).toISOString() : 
            new Date('2099-12-31').toISOString();
        
        await db.run(`
            INSERT INTO access_grants (cid, granter_addr, grantee_addr, expires_at, is_active)
            VALUES (?, ?, ?, ?, ?)
        `, [cid, granter, grantee, expiresAt, 1]);
        
        res.json({
            success: true,
            data: {
                cid,
                grantee,
                expires_at: expiresAt,
                granted_at: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Grant access error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to grant access'
        });
    }
});

// User stats
app.get('/api/v1/users/:address/stats', async (req, res) => {
    try {
        const { address } = req.params;
        
        const stats = await db.get(`
            SELECT 
                COUNT(*) as total_files,
                SUM(file_size) as total_size,
                SUM(CASE WHEN is_encrypted = 1 THEN 1 ELSE 0 END) as encrypted_files
            FROM file_records 
            WHERE uploader_addr = ?
        `, [address]);
        
        res.json({
            success: true,
            data: {
                total_files: stats.total_files || 0,
                total_size_bytes: stats.total_size || 0,
                encrypted_files: stats.encrypted_files || 0,
                rewards_earned: stats.total_files || 0 // Mock calculation
            }
        });
        
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user stats'
        });
    }
});

// User files
app.get('/api/v1/users/:address/files', async (req, res) => {
    try {
        const { address } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        const files = await db.all(`
            SELECT * FROM file_records 
            WHERE uploader_addr = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `, [address, limit, offset]);
        
        const total = await db.get(
            'SELECT COUNT(*) as count FROM file_records WHERE uploader_addr = ?',
            [address]
        );
        
        res.json({
            success: true,
            data: {
                files,
                pagination: {
                    page,
                    limit,
                    total: total.count,
                    total_pages: Math.ceil(total.count / limit)
                }
            }
        });
        
    } catch (error) {
        console.error('Files error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user files'
        });
    }
});

// Helper functions
async function checkFileAccess(cid, userAddress) {
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

// Initialize and start server
async function startServer() {
    try {
        console.log('🚀 Starting PrivyChain backend...');
        console.log('================================');
        
        // Show environment info
        console.log('📋 Environment Configuration:');
        console.log(`   NODE_ENV: ${process.env.NODE_ENV || process.env.ENVIRONMENT || 'development'}`);
        console.log(`   Database: ${process.env.DATABASE_PATH || './privychain.db'}`);
        console.log(`   Contract: ${process.env.CONTRACT_ADDRESS ? '✅ Configured' : '❌ Not configured'}`);
        console.log(`   Web3 Token: ${process.env.WEB3_STORAGE_TOKEN ? '✅ Found (legacy)' : '❌ Not found'}`);
        console.log(`   Signature Verification: ${process.env.SKIP_SIGNATURE_VERIFICATION === 'true' ? '⚠️  DISABLED' : '✅ ENABLED'}`);
        console.log('');
        
        await initializeDatabase();
        const w3upReady = await initializeW3up();
        
        if (!w3upReady) {
            console.log('⚠️  Storage service not ready. File uploads will not work.');
            console.log('💡 Your existing Web3.Storage configuration should work automatically.');
            console.log('💡 If needed, run: npm run setup');
        }
        
        app.listen(PORT, () => {
            console.log('');
            console.log('✅ PrivyChain backend is running!');
            console.log('=================================');
            console.log(`🌐 Server: http://localhost:${PORT}`);
            console.log(`📊 Health: http://localhost:${PORT}/api/v1/health`);
            console.log(`📤 Upload: http://localhost:${PORT}/api/v1/upload`);
            console.log('');
            
            if (!w3upReady) {
                console.log('⚠️  Note: File uploads may not work until storage is configured');
                console.log('');
            }
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();