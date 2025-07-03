// src/routes/users.js - User-related routes
import express from 'express';
import { UserController } from '../controllers/userController.js';

const router = express.Router();

// User operations
router.get('/:address/stats', UserController.getStats);
router.get('/:address/files', UserController.getFiles);
router.get('/:address/profile', UserController.getProfile);

export default router;