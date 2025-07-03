// src/controllers/fileController.js - File upload/download logic
import { FileRecord } from '../models/FileRecord.js';
import { AccessGrant } from '../models/AccessGrant.js';
import { StorageService } from '../services/storageService.js';
import { EncryptionService } from '../services/encryptionService.js';
import { AuthService } from '../services/authService.js';
import { sendSuccess, sendError, sendValidationError } from '../utils/response.js';

export class FileController {
  static async upload(req, res) {
    try {
      const { file, file_name, content_type, should_encrypt, metadata, user_address, signature } = req.body;
      
      // Basic validation
      const errors = [];
      if (!file) errors.push({ field: 'file', message: 'File is required' });
      if (!file_name) errors.push({ field: 'file_name', message: 'File name is required' });
      
      // Add auth validation
      errors.push(...AuthService.validateRequest(req.body));
      
      if (errors.length > 0) {
        return sendValidationError(res, errors);
      }
      
      // Verify signature
      if (!AuthService.verifySignature(user_address, signature, file)) {
        return sendError(res, 401, 'Invalid signature');
      }
      
      console.log(`🔄 Processing upload: ${file_name} for ${user_address}`);
      
      // Convert base64 to buffer
      const fileBuffer = Buffer.from(file, 'base64');
      
      // Encrypt if requested
      let fileToUpload = fileBuffer;
      if (should_encrypt) {
        console.log('🔐 Encrypting file...');
        fileToUpload = await EncryptionService.encryptFile(fileBuffer, user_address);
      }
      
      // Upload to storage
      const cid = await StorageService.uploadFile(fileToUpload, file_name, content_type);
      console.log(`✅ Upload successful! CID: ${cid}`);
      
      // Store in database
      await FileRecord.create({
        cid,
        uploader_addr: user_address,
        file_size: fileBuffer.length,
        is_encrypted: should_encrypt,
        file_name,
        content_type,
        metadata: metadata || {},
        status: 'confirmed'
      });
      
      sendSuccess(res, {
        cid,
        file_size: fileBuffer.length,
        is_encrypted: should_encrypt,
        status: 'confirmed',
        gateway_url: StorageService.getGatewayUrl(cid)
      });
      
    } catch (error) {
      console.error('Upload error:', error);
      sendError(res, 500, 'Storage upload failed');
    }
  }

  static async retrieve(req, res) {
    try {
      const { cid, user_address, signature } = req.body;
      
      // Validation
      const errors = [];
      if (!cid) errors.push({ field: 'cid', message: 'CID is required' });
      errors.push(...AuthService.validateRequest(req.body));
      
      if (errors.length > 0) {
        return sendValidationError(res, errors);
      }
      
      // Verify signature
      if (!AuthService.verifySignature(user_address, signature, cid)) {
        return sendError(res, 401, 'Invalid signature');
      }
      
      // Get file record
      const fileRecord = await FileRecord.findByCid(cid);
      if (!fileRecord) {
        return sendError(res, 404, 'File not found');
      }
      
      // Check access permissions
      const hasAccess = await AccessGrant.hasAccess(cid, user_address);
      if (!hasAccess) {
        return sendError(res, 403, 'Access denied');
      }
      
      console.log(`🔄 Retrieving file: ${cid}`);
      
      // Retrieve from storage
      let fileData = await StorageService.retrieveFile(cid);
      
      // Decrypt if necessary
      if (fileRecord.is_encrypted) {
        console.log('🔓 Decrypting file...');
        fileData = await EncryptionService.decryptFile(Buffer.from(fileData), user_address);
      }
      
      sendSuccess(res, {
        file: Buffer.from(fileData).toString('base64'),
        file_name: fileRecord.file_name,
        content_type: fileRecord.content_type,
        metadata: fileRecord.metadata
      });
      
    } catch (error) {
      console.error('Retrieve error:', error);
      sendError(res, 500, 'File retrieval failed');
    }
  }

  static async grantAccess(req, res) {
    try {
      const { cid, grantee, duration, granter, signature } = req.body;
      
      // Validation
      const errors = [];
      if (!cid) errors.push({ field: 'cid', message: 'CID is required' });
      if (!grantee) errors.push({ field: 'grantee', message: 'Grantee address is required' });
      if (!granter) errors.push({ field: 'granter', message: 'Granter address is required' });
      if (!signature) errors.push({ field: 'signature', message: 'Signature is required' });
      
      if (grantee && !AuthService.isValidAddress(grantee)) {
        errors.push({ field: 'grantee', message: 'Invalid grantee address' });
      }
      
      if (granter && !AuthService.isValidAddress(granter)) {
        errors.push({ field: 'granter', message: 'Invalid granter address' });
      }
      
      if (errors.length > 0) {
        return sendValidationError(res, errors);
      }
      
      // Verify signature
      if (!AuthService.verifySignature(granter, signature, cid + grantee)) {
        return sendError(res, 401, 'Invalid signature');
      }
      
      // Check if granter owns the file
      const fileRecord = await FileRecord.findByCid(cid);
      if (!fileRecord || fileRecord.uploader_addr.toLowerCase() !== granter.toLowerCase()) {
        return sendError(res, 403, 'Not authorized to grant access');
      }
      
      // Create access grant
      const expiresAt = duration 
        ? new Date(Date.now() + duration * 1000).toISOString()
        : new Date('2099-12-31').toISOString();
      
      await AccessGrant.create({
        cid,
        granter_addr: granter,
        grantee_addr: grantee,
        expires_at: expiresAt,
        is_active: true
      });
      
      sendSuccess(res, {
        cid,
        grantee,
        expires_at: expiresAt,
        granted_at: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Grant access error:', error);
      sendError(res, 500, 'Failed to grant access');
    }
  }

  static async revokeAccess(req, res) {
    try {
      const { cid, grantee, granter, signature } = req.body;
      
      if (!cid || !grantee || !granter || !signature) {
        return sendError(res, 400, 'Missing required fields');
      }
      
      // Verify signature
      if (!AuthService.verifySignature(granter, signature, cid + grantee + 'revoke')) {
        return sendError(res, 401, 'Invalid signature');
      }
      
      // Revoke access
      const result = await AccessGrant.revokeAccess(cid, granter, grantee);
      
      if (result.changes === 0) {
        return sendError(res, 404, 'Access grant not found');
      }
      
      sendSuccess(res, {
        cid,
        grantee,
        status: 'revoked'
      });
      
    } catch (error) {
      console.error('Revoke access error:', error);
      sendError(res, 500, 'Failed to revoke access');
    }
  }
}