import express from 'express';
import { createTrade, getMyTrades, getTradeById, getMarketplaceTrades, updateTrade, deleteTrade } from '../controllers/tradeController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/marketplace', authenticate, getMarketplaceTrades);
router.post('/', authenticate, authorize(['IMPORTER']), createTrade);
router.get('/', authenticate, getMyTrades);
router.get('/:id', authenticate, getTradeById);
router.patch('/:id', authenticate, updateTrade);
router.delete('/:id', authenticate, authorize(['IMPORTER']), deleteTrade);

export default router;
