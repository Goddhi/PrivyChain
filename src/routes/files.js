// src/routes/files.js - File-related routes
import express from 'express';
import { FileController } from '../controllers/fileController.js';

const router = express.Router();

// File operations
router.post('/upload', FileController.upload);
router.post('/retrieve', FileController.retrieve);

// Access control
router.post('/access/grant', FileController.grantAccess);
router.post('/access/revoke', FileController.revokeAccess);

export default router;