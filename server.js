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

// PrivyChain Contract ABI
const PRIVYCHAIN_ABI = [
    // File operations
    "function recordUpload(bytes32 cid, uint256 fileSize, bool isEncrypted, string calldata metadata) external",
    "function claimUploadReward(bytes32 cid) external",
    "function batchClaimRewards(bytes32[] calldata cids) external",
    
    // Access control
    "function grantAccess(bytes32 cid, address grantee, uint256 duration) external",
    "function revokeAccess(bytes32 cid, address grantee) external",
    "function hasAccess(bytes32 cid, address viewer) external view returns (bool)",
    
    // View functions
    "function getFileRecord(bytes32 cid) external view returns (tuple(bytes32 cid, address uploader, uint256 timestamp, uint256 fileSize, bool isEncrypted, bool rewardClaimed, string metadata))",
    "function getUserUploads(address user) external view returns (bytes32[] memory)",
    "function getAccessGrant(bytes32 cid, address grantee) external view returns (tuple(address granter, address grantee, uint256 expiresAt, bool isActive))",
    "function calculateReward(uint256 fileSize, bool isEncrypted) public view returns (uint256)",
    
    // Configuration
    "function baseRewardAmount() external view returns (uint256)",
    "function sizeMultiplier() external view returns (uint256)",
    "function encryptionBonus() external view returns (uint256)",
    "function totalFilesStored() external view returns (uint256)",
    "function totalRewardsDistributed() external view returns (uint256)",
    "function totalStorageUsed() external view returns (uint256)",
    "function userRewardBalance(address user) external view returns (uint256)",
    
    // Events
    "event FileUploaded(bytes32 indexed cid, address indexed uploader, uint256 fileSize, bool isEncrypted, uint256 timestamp)",
    "event RewardClaimed(bytes32 indexed cid, address indexed uploader, uint256 rewardAmount, uint256 timestamp)",
    "event AccessGranted(bytes32 indexed cid, address indexed granter, address indexed grantee, uint256 expiresAt)",
    "event AccessRevoked(bytes32 indexed cid, address indexed granter, address indexed grantee)"
];

// Contract Service Class
class PrivyChainContractService {
    constructor() {
        this.provider = null;
        this.contract = null;
        this.wallet = null;
        this.isReady = false;
    }

    async initialize() {
        try {
            console.log('🔗 Initializing PrivyChain contract service...');
            
            // Initialize provider
            this.provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC);
            
            // Initialize wallet for sending transactions
            if (process.env.PRIVATE_KEY) {
                this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
                console.log(`✅ Wallet connected: ${this.wallet.address}`);
                
                // Check wallet balance
                const balance = await this.provider.getBalance(this.wallet.address);
                console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} FIL`);
            }

            // Initialize contract
            if (process.env.CONTRACT_ADDRESS) {
                this.contract = new ethers.Contract(
                    process.env.CONTRACT_ADDRESS,
                    PRIVYCHAIN_ABI,
                    this.wallet || this.provider
                );
                
                // Verify contract is deployed
                const code = await this.provider.getCode(process.env.CONTRACT_ADDRESS);
                if (code === "0x") {
                    throw new Error("No contract found at the specified address");
                }
                
                console.log(`✅ PrivyChain contract connected: ${process.env.CONTRACT_ADDRESS}`);
                
                // Get contract info
                try {
                    const totalFiles = await this.contract.totalFilesStored();
                    const totalRewards = await this.contract.totalRewardsDistributed();
                    console.log(`📊 Contract stats: ${totalFiles} files, ${ethers.formatEther(totalRewards)} FIL rewards`);
                } catch (error) {
                    console.log('⚠️ Could not fetch contract stats (contract might be paused)');
                }
                
                this.isReady = true;
            } else {
                console.log('⚠️ No contract address configured');
            }

            return this.isReady;
        } catch (error) {
            console.error('❌ Contract service initialization failed:', error.message);
            return false;
        }
    }

    // Convert string CID to bytes32
    cidToBytes32(cidString) {
        // Remove 'Qm' prefix if present and convert to bytes32
        const cleanCid = cidString.startsWith('Qm') ? cidString.slice(2) : cidString;
        return ethers.keccak256(ethers.toUtf8Bytes(cleanCid));
    }

    // Record file upload on blockchain
    async recordFileUpload(cid, fileSize, isEncrypted, metadata, uploaderAddress) {
        if (!this.isReady || !this.wallet) {
            console.log('⚠️ Contract not ready or no wallet, skipping blockchain recording');
            return null;
        }

        try {
            console.log(`📝 Recording file upload on blockchain: ${cid}`);
            
            const cidBytes32 = this.cidToBytes32(cid);
            const metadataJson = JSON.stringify(metadata || {});
            
            // Estimate gas first
            const gasEstimate = await this.contract.recordUpload.estimateGas(
                cidBytes32,
                fileSize,
                isEncrypted,
                metadataJson
            );
            
            console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);
            
            // Send transaction with higher gas limit
            const tx = await this.contract.recordUpload(
                cidBytes32,
                fileSize,
                isEncrypted,
                metadataJson,
                {
                    gasLimit: gasEstimate * 120n / 100n // 20% buffer
                }
            );
            
            console.log(`📤 Transaction sent: ${tx.hash}`);
            const receipt = await tx.wait();
            
            console.log(`✅ File recorded on blockchain! Block: ${receipt.blockNumber}`);
            return receipt.hash;
            
        } catch (error) {
            console.error('❌ Failed to record file on blockchain:', error.message);
            return null;
        }
    }

    // Get file record from blockchain
    async getFileRecord(cid) {
        if (!this.isReady) {
            return null;
        }

        try {
            const cidBytes32 = this.cidToBytes32(cid);
            const record = await this.contract.getFileRecord(cidBytes32);
            
            return {
                cid: record[0],
                uploader: record[1],
                timestamp: record[2].toString(),
                fileSize: record[3].toString(),
                isEncrypted: record[4],
                rewardClaimed: record[5],
                metadata: record[6]
            };
        } catch (error) {
            console.error('❌ Failed to get file record from blockchain:', error.message);
            return null;
        }
    }

    // Check if user has access to file
    async checkFileAccess(cid, userAddress) {
        if (!this.isReady) {
            return false;
        }

        try {
            const cidBytes32 = this.cidToBytes32(cid);
            return await this.contract.hasAccess(cidBytes32, userAddress);
        } catch (error) {
            console.error('❌ Failed to check file access:', error.message);
            return false;
        }
    }

    // Grant access to file
    async grantFileAccess(cid, granteeAddress, duration = 0) {
        if (!this.isReady || !this.wallet) {
            console.log('⚠️ Contract not ready or no wallet');
            return null;
        }

        try {
            console.log(`🔐 Granting access on blockchain: ${cid} to ${granteeAddress}`);
            
            const cidBytes32 = this.cidToBytes32(cid);
            
            const tx = await this.contract.grantAccess(
                cidBytes32,
                granteeAddress,
                duration
            );
            
            const receipt = await tx.wait();
            console.log(`✅ Access granted on blockchain! TX: ${receipt.hash}`);
            return receipt.hash;
            
        } catch (error) {
            console.error('❌ Failed to grant access on blockchain:', error.message);
            return null;
        }
    }

    // Calculate reward for file
    async calculateReward(fileSize, isEncrypted) {
        if (!this.isReady) {
            return "0";
        }

        try {
            const reward = await this.contract.calculateReward(fileSize, isEncrypted);
            return ethers.formatEther(reward);
        } catch (error) {
            console.error('❌ Failed to calculate reward:', error.message);
            return "0";
        }
    }

    // Get user's uploaded files from blockchain
    async getUserUploads(userAddress) {
        if (!this.isReady) {
            return [];
        }

        try {
            const uploads = await this.contract.getUserUploads(userAddress);
            return uploads.map(cid => cid.toString());
        } catch (error) {
            console.error('❌ Failed to get user uploads:', error.message);
            return [];
        }
    }

    // Get contract statistics
    async getContractStats() {
        if (!this.isReady) {
            return null;
        }

        try {
            const [totalFiles, totalRewards, totalStorage, baseReward, sizeMultiplier, encryptionBonus] = await Promise.all([
                this.contract.totalFilesStored(),
                this.contract.totalRewardsDistributed(),
                this.contract.totalStorageUsed(),
                this.contract.baseRewardAmount(),
                this.contract.sizeMultiplier(),
                this.contract.encryptionBonus()
            ]);

            return {
                totalFiles: totalFiles.toString(),
                totalRewardsDistributed: ethers.formatEther(totalRewards),
                totalStorageUsed: totalStorage.toString(),
                baseRewardAmount: ethers.formatEther(baseReward),
                sizeMultiplier: sizeMultiplier.toString(),
                encryptionBonus: ethers.formatEther(encryptionBonus)
            };
        } catch (error) {
            console.error('❌ Failed to get contract stats:', error.message);
            return null;
        }
    }

    // Get user reward balance
    async getUserRewardBalance(userAddress) {
        if (!this.isReady) {
            return "0";
        }

        try {
            const balance = await this.contract.userRewardBalance(userAddress);
            return ethers.formatEther(balance);
        } catch (error) {
            console.error('❌ Failed to get user reward balance:', error.message);
            return "0";
        }
    }
}

// Initialize contract service
const contractService = new PrivyChainContractService();

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
app.get('/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            service: 'privychain-backend',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            w3up_ready: w3upClient !== null,
            database_ready: db !== null,
            contract_ready: contractService.isReady,
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

// File upload (enhanced with blockchain integration)
app.post('/upload', async (req, res) => {
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
        
        // Record on blockchain
        let txHash = null;
        let expectedReward = "0";
        try {
            // Calculate expected reward
            expectedReward = await contractService.calculateReward(fileBuffer.length, should_encrypt);
            
            // Record upload on blockchain
            txHash = await contractService.recordFileUpload(
                cid.toString(),
                fileBuffer.length,
                should_encrypt,
                metadata,
                user_address
            );
        } catch (error) {
            console.log('⚠️ Blockchain recording failed, continuing with database only:', error.message);
        }
        
        // Store in database
        await db.run(`
            INSERT INTO file_records 
            (cid, uploader_addr, file_size, is_encrypted, file_name, content_type, metadata, status, tx_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            cid.toString(),
            user_address,
            fileBuffer.length,
            should_encrypt ? 1 : 0,
            file_name,
            content_type,
            JSON.stringify(metadata || {}),
            'confirmed',
            txHash
        ]);
        
        res.json({
            success: true,
            data: {
                cid: cid.toString(),
                file_size: fileBuffer.length,
                is_encrypted: should_encrypt,
                status: 'confirmed',
                gateway_url: `https://w3s.link/ipfs/${cid}`,
                tx_hash: txHash,
                blockchain_stored: !!txHash,
                expected_reward_fil: expectedReward
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

// File retrieval
app.post('/retrieve', async (req, res) => {
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

// Grant access (enhanced with blockchain integration)
app.post('/access/grant', async (req, res) => {
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
        
        // Grant access on blockchain
        let blockchainTxHash = null;
        try {
            blockchainTxHash = await contractService.grantFileAccess(cid, grantee, duration || 0);
        } catch (error) {
            console.log('⚠️ Blockchain access grant failed, continuing with database only');
        }
        
        // Create access grant in database
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
                granted_at: new Date().toISOString(),
                blockchain_tx: blockchainTxHash
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

app.post('/rewards/claim', async (req, res) => {
    try {
        const { cid, user_address, signature } = req.body;
        
        if (!cid || !user_address || !signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        if (!AuthService.verifySignature(user_address, signature, cid)) {
            return res.status(401).json({
                success: false,
                error: 'Invalid signature'
            });
        }
        
        const fileRecord = await db.get(
            'SELECT * FROM file_records WHERE cid = ? AND uploader_addr = ?',
            [cid, user_address]
        );
        
        if (!fileRecord) {
            return res.status(404).json({
                success: false,
                error: 'File not found or not owned by user'
            });
        }
        
        if (!contractService.isReady) {
            return res.status(503).json({
                success: false,
                error: 'Blockchain service not available'
            });
        }
        
        try {
            // Claim reward on blockchain
            const cidBytes32 = contractService.cidToBytes32(cid);
            const tx = await contractService.contract.claimUploadReward(cidBytes32);
            const receipt = await tx.wait();
            
            res.json({
                success: true,
                data: {
                    cid,
                    tx_hash: receipt.hash,
                    block_number: receipt.blockNumber,
                    message: 'Reward claimed successfully'
                }
            });
            
        } catch (error) {
            res.status(400).json({
                success: false,
                error: 'Failed to claim reward',
                details: error.message.includes('already claimed') ? 'Reward already claimed' : 'Claiming failed'
            });
        }
        
    } catch (error) {
        console.error('Claim reward error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process reward claim'
        });
    }
});

// User stats (enhanced with blockchain data)
app.get('/users/:address/stats', async (req, res) => {
    try {
        const { address } = req.params;
        
        // Get database stats
        const dbStats = await db.get(`
            SELECT 
                COUNT(*) as total_files,
                SUM(file_size) as total_size,
                SUM(CASE WHEN is_encrypted = 1 THEN 1 ELSE 0 END) as encrypted_files
            FROM file_records 
            WHERE uploader_addr = ?
        `, [address]);
        
        // Get blockchain stats
        let blockchainStats = {
            reward_balance: "0",
            blockchain_files: [],
            can_claim_rewards: false
        };
        
        try {
            if (contractService.isReady) {
                const [rewardBalance, userUploads] = await Promise.all([
                    contractService.getUserRewardBalance(address),
                    contractService.getUserUploads(address)
                ]);
                
                blockchainStats = {
                    reward_balance: rewardBalance,
                    blockchain_files: userUploads,
                    can_claim_rewards: userUploads.length > 0
                };
            }
        } catch (error) {
            console.log('⚠️ Could not fetch blockchain stats');
        }
        
        res.json({
            success: true,
            data: {
                // Database stats
                total_files: dbStats.total_files || 0,
                total_size_bytes: dbStats.total_size || 0,
                encrypted_files: dbStats.encrypted_files || 0,
                
                // Blockchain stats
                reward_balance_fil: blockchainStats.reward_balance,
                blockchain_files_count: blockchainStats.blockchain_files.length,
                can_claim_rewards: blockchainStats.can_claim_rewards,
                
                // Combined
                rewards_earned: dbStats.total_files || 0 // Mock calculation
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
app.get('/users/:address/files', async (req, res) => {
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

// Contract statistics
app.get('/contract/stats', async (req, res) => {
    try {
        if (!contractService.isReady) {
            return res.json({
                success: false,
                error: 'Contract not available'
            });
        }
        
        const stats = await contractService.getContractStats();
        
        if (!stats) {
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch contract statistics'
            });
        }
        
        res.json({
            success: true,
            data: {
                contract_address: process.env.CONTRACT_ADDRESS,
                network: "Filecoin Calibration Testnet",
                total_files_stored: stats.totalFiles,
                total_rewards_distributed_fil: stats.totalRewardsDistributed,
                total_storage_used_bytes: stats.totalStorageUsed,
                reward_config: {
                    base_reward_fil: stats.baseRewardAmount,
                    size_multiplier: stats.sizeMultiplier,
                    encryption_bonus_fil: stats.encryptionBonus
                }
            }
        });
        
    } catch (error) {
        console.error('Contract stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get contract statistics'
        });
    }
});

// Contract status
app.get('/contract/status', async (req, res) => {
    try {
        if (!contractService.provider || !process.env.CONTRACT_ADDRESS) {
            return res.json({
                success: false,
                error: 'Contract not configured'
            });
        }

        const code = await contractService.provider.getCode(process.env.CONTRACT_ADDRESS);
        const balance = await contractService.provider.getBalance(process.env.CONTRACT_ADDRESS);
        
        // Get wallet info if available
        let walletInfo = null;
        if (contractService.wallet) {
            const walletBalance = await contractService.provider.getBalance(contractService.wallet.address);
            walletInfo = {
                address: contractService.wallet.address,
                balance_fil: ethers.formatEther(walletBalance)
            };
        }

        // Get contract stats if available
        let contractStats = null;
        if (contractService.isReady) {
            contractStats = await contractService.getContractStats();
        }

        res.json({
            success: true,
            data: {
                contract_address: process.env.CONTRACT_ADDRESS,
                network: "Filecoin Calibration Testnet",
                rpc_url: process.env.ETHEREUM_RPC,
                is_deployed: code !== "0x",
                bytecode_length: code.length,
                contract_balance_fil: ethers.formatEther(balance),
                wallet: walletInfo,
                can_write: !!contractService.wallet,
                is_ready: contractService.isReady,
                stats: contractStats
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to check contract status',
            details: error.message
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
    
    // Check database access grants
    const grant = await db.get(`
        SELECT * FROM access_grants 
        WHERE cid = ? AND grantee_addr = ? AND is_active = 1 
        AND (expires_at IS NULL OR expires_at > datetime('now'))
    `, [cid, userAddress]);
    
    if (grant) return true;
    
    // Check blockchain access grants if contract is available
    if (contractService.isReady) {
        try {
            const hasBlockchainAccess = await contractService.checkFileAccess(cid, userAddress);
            if (hasBlockchainAccess) return true;
        } catch (error) {
            console.log('⚠️ Could not check blockchain access');
        }
    }
    
    return false;
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
        
        // Initialize contract service
        const contractReady = await contractService.initialize();
        console.log(`📝 Smart Contract: ${contractReady ? '✅ Connected' : '⚠️ Not available'}`);
        
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
            console.log(`📊 Health: http://localhost:${PORT}/health`);
            console.log(`📤 Upload: http://localhost:${PORT}/upload`);
            console.log(`🏆 Rewards: http://localhost:${PORT}/rewards/claim`);
            console.log(`📈 Contract: http://localhost:${PORT}/contract/status`);
            console.log('');
            
            if (!w3upReady) {
                console.log('⚠️  Note: File uploads may not work until storage is configured');
            }
            if (!contractReady) {
                console.log('⚠️  Note: Blockchain features disabled until contract is available');
            }
            console.log('');
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();