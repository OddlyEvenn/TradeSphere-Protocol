import express from 'express';
import { createTrade, getMyTrades, getTradeById } from '../controllers/tradeController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/', authenticate, authorize(['IMPORTER']), createTrade);
router.get('/', authenticate, getMyTrades);
router.get('/:id', authenticate, getTradeById);

export default router;
