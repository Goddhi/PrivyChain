// src/config/storage.js - Storage provider configuration (updated for existing setup)
import { create } from '@web3-storage/w3up-client';
import { config } from './app.js';

let w3upClient = null;
let initialized = false;

export async function initializeStorage() {
  if (initialized) return w3upClient !== null;

  try {
    console.log('🔧 Initializing Web3.Storage w3up client...');
    w3upClient = await create();
    
    // Check if already logged in (from previous setup)
    const accounts = w3upClient.accounts();
    if (Object.keys(accounts).length === 0) {
      console.log('⚠️  No w3up account found.');
      
      // If we have a token in config, try to use it
      if (config.storage.token) {
        console.log('💡 Found WEB3_STORAGE_TOKEN in config - using existing setup');
        console.log('⚠️  Note: This backend uses w3up client, not the legacy token');
        console.log('💡 Your existing w3up configuration should work automatically');
      } else {
        console.log('💡 Run: npm run setup');
      }
      return false;
    }
    
    // Check current space
    const currentSpace = w3upClient.currentSpace();
    if (!currentSpace) {
      console.log('⚠️  No current space set.');
      
      // Try to create or set a space
      try {
        const spaces = Object.values(w3upClient.spaces());
        if (spaces.length > 0) {
          await w3upClient.setCurrentSpace(spaces[0].did());
          console.log(`✅ Using existing space: ${spaces[0].did()}`);
        } else {
          console.log('💡 Run: npm run setup to create a space');
          return false;
        }
      } catch (error) {
        console.log('💡 Run: npm run setup to configure storage');
        return false;
      }
    } else {
      console.log(`✅ Using space: ${currentSpace.did()}`);
    }
    
    initialized = true;
    console.log('✅ Storage service initialized successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to initialize storage:', error.message);
    
    // Provide helpful guidance
    if (config.storage.token) {
      console.log('💡 You have WEB3_STORAGE_TOKEN configured.');
      console.log('💡 This JS backend uses w3up client instead.');
      console.log('💡 Your existing w3up setup should work automatically.');
      console.log('💡 If you need to reconfigure, run: npm run setup');
    } else {
      console.log('💡 Run: npm run setup to configure Web3.Storage');
    }
    
    return false;
  }
}

export function getStorageClient() {
  if (!w3upClient) {
    throw new Error('Storage not initialized. Call initializeStorage() first.');
  }
  return w3upClient;
}

export function isStorageReady() {
  return initialized && w3upClient !== null;
}

export function getStorageInfo() {
  if (!w3upClient) return null;
  
  const accounts = w3upClient.accounts();
  const currentSpace = w3upClient.currentSpace();
  
  return {
    hasAccounts: Object.keys(accounts).length > 0,
    currentSpace: currentSpace?.did() || null,
    isReady: initialized
  };
}