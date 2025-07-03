// src/controllers/userController.js - User management
import { User } from '../models/User.js';
import { AuthService } from '../services/authService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export class UserController {
  static async getStats(req, res) {
    try {
      const { address } = req.params;
      
      if (!AuthService.isValidAddress(address)) {
        return sendError(res, 400, 'Invalid Ethereum address');
      }
      
      const stats = await User.getStats(address);
      
      sendSuccess(res, {
        total_files: stats.total_files || 0,
        total_size_bytes: stats.total_size || 0,
        encrypted_files: stats.encrypted_files || 0,
        rewards_earned: stats.total_files || 0 // Mock calculation
      });
      
    } catch (error) {
      console.error('Stats error:', error);
      sendError(res, 500, 'Failed to get user stats');
    }
  }

  static async getFiles(req, res) {
    try {
      const { address } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      
      if (!AuthService.isValidAddress(address)) {
        return sendError(res, 400, 'Invalid Ethereum address');
      }
      
      const result = await User.getFiles(address, { page, limit });
      
      sendSuccess(res, result);
      
    } catch (error) {
      console.error('Files error:', error);
      sendError(res, 500, 'Failed to get user files');
    }
  }

  static async getProfile(req, res) {
    try {
      const { address } = req.params;
      
      if (!AuthService.isValidAddress(address)) {
        return sendError(res, 400, 'Invalid Ethereum address');
      }
      
      const stats = await User.getStats(address);
      
      sendSuccess(res, {
        address,
        total_files: stats.total_files || 0,
        total_size_bytes: stats.total_size || 0,
        encrypted_files: stats.encrypted_files || 0,
        joined_at: new Date().toISOString(), // Mock data
        last_activity: new Date().toISOString() // Mock data
      });
      
    } catch (error) {
      console.error('Profile error:', error);
      sendError(res, 500, 'Failed to get user profile');
    }
  }
}