import { Router } from 'express';
import multer from 'multer';
import { uploadDocument, getDocumentUrl } from '../controllers/documentController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Configure multer for memory storage (we send buffer directly to IPFS)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    }
});

// Routes
router.post('/upload', authenticate, upload.single('file'), uploadDocument);
router.get('/:tradeId/:docType', authenticate, getDocumentUrl);

export default router;
