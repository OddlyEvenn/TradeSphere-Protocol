import express from 'express';
import { createListing, getAllListings, submitOffer, getOffersForTrade, finalizeOffer, declineOffer } from '../controllers/marketplaceController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/listings', authenticate, getAllListings);
router.post('/listings', authenticate, authorize(['EXPORTER']), createListing);
router.post('/offers', authenticate, authorize(['EXPORTER']), submitOffer);
router.get('/trades/:tradeId/offers', authenticate, getOffersForTrade);
router.post('/offers/:offerId/accept', authenticate, authorize(['IMPORTER']), finalizeOffer);
router.post('/offers/:offerId/decline', authenticate, authorize(['IMPORTER']), declineOffer);

export default router;
