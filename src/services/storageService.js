// src/services/storageService.js - Web3.Storage integration service
import { getStorageClient, isStorageReady } from '../config/storage.js';

export class StorageService {
  static async uploadFile(fileBuffer, fileName, contentType = 'application/octet-stream') {
    if (!isStorageReady()) {
      throw new Error('Storage service not initialized');
    }

    const client = getStorageClient();
    const fileObj = new File([fileBuffer], fileName, { type: contentType });
    const cid = await client.uploadFile(fileObj);
    return cid.toString();
  }

  static async retrieveFile(cid) {
    const response = await fetch(`https://w3s.link/ipfs/${cid}`);
    
    if (!response.ok) {
      throw new Error(`Failed to retrieve file: ${response.status}`);
    }
    
    return await response.arrayBuffer();
  }

  static isReady() {
    return isStorageReady();
  }

  static getGatewayUrl(cid) {
    return `https://w3s.link/ipfs/${cid}`;
  }
}