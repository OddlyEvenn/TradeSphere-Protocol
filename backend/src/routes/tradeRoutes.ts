import express from 'express';
import { createTrade, getMyTrades, getTradeById, getMarketplaceTrades, getTradeEvents, updateTrade, updateTradeState, deleteTrade } from '../controllers/tradeController';
import { processScheduling } from '../controllers/adminController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/marketplace', authenticate, getMarketplaceTrades);
router.post('/', authenticate, authorize(['IMPORTER']), createTrade);
router.get('/', authenticate, getMyTrades);
router.get('/:id', authenticate, getTradeById);
router.get('/:id/events', authenticate, getTradeEvents);
router.patch('/:id', authenticate, updateTrade);
router.patch('/:id/state', authenticate, updateTradeState);
router.delete('/:id', authenticate, authorize(['IMPORTER']), deleteTrade);

// Scheduling logic (Restrict to Banking/Regulators in a real app)
router.post('/schedule', authenticate, processScheduling);

export default router;
