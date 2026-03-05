import express from 'express';
import { getUsers } from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', authenticate, getUsers);

export default router;
