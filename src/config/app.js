// src/config/app.js - Application configuration (updated for existing env)
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 8080,
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || process.env.ENVIRONMENT || 'development'
  },

  // Database configuration (supports both SQLite and PostgreSQL)
  database: {
    path: process.env.DATABASE_PATH || './privychain.db',
    url: process.env.DATABASE_URL, // PostgreSQL URL if available
    redis: process.env.REDIS_URL
  },

  // Blockchain configuration
  blockchain: {
    rpc: process.env.ETHEREUM_RPC || 'https://api.node.glif.io',
    contractAddress: process.env.CONTRACT_ADDRESS,
    privateKey: process.env.PRIVATE_KEY
  },

  // Web3.Storage configuration
  storage: {
    token: process.env.WEB3_STORAGE_TOKEN,
    email: process.env.W3UP_EMAIL,
    provider: process.env.DEFAULT_STORAGE_PROVIDER || 'web3storage'
  },

  // Privy configuration
  privy: {
    apiKey: process.env.PRIVY_API_KEY,
    appId: process.env.PRIVY_APP_ID
  },

  // Security configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
    skipSignatureVerification: process.env.SKIP_SIGNATURE_VERIFICATION === 'true'
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },

  // File upload limits
  upload: {
    maxFileSize: 100 * 1024 * 1024 * 1024, // 100GB
    allowedTypes: ['*']
  },

  // Debug mode
  debug: process.env.DEBUG === 'true'
};