import { prisma } from '../services/PrismaService';
import { logger } from '../utils/logger';
import { Request, Response } from 'express';
import { getStringParam } from '../utils/request';

interface AuthUser {
    userId: string;
    role: string;
}

interface AuthRequest extends Request {
    user: AuthUser;
}

export const createListing = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;

        const { productId, price, quantity } = req.body;
        const exporterId = authReq.user.userId;

        const listing = await prisma.marketplaceListing.create({
            data: {
                productId,
                exporterId,
                price: parseFloat(price),
                quantity: parseInt(quantity),
                status: 'ACTIVE'
            }
        });


        res.status(201).json(listing);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getAllListings = async (req: Request, res: Response) => {
    try {
        const listings = await prisma.marketplaceListing.findMany({
            where: { status: 'ACTIVE' },
            include: {
                product: true,
                exporter: { select: { id: true, name: true } }
            }
        });
        res.json(listings);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const submitOffer = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const { amount, shippingTimeline, termsAndConditions, deliveryTerms, message, validUntil } = req.body;
        const tradeId = getStringParam(req.body.tradeId);
        const exporterId = authReq.user.userId;

        // Validate required fields
        if (!tradeId || !amount || !shippingTimeline || !termsAndConditions) {
            return res.status(400).json({
                message: 'Missing required fields: tradeId, amount, shippingTimeline, termsAndConditions'
            });
        }

        // Check trade exists and is open for offers
        const trade = await prisma.trade.findUnique({
            where: { id: tradeId }
        });

        if (!trade) {
            return res.status(404).json({ message: 'Trade not found' });
        }

        if (trade.status !== 'OPEN_FOR_OFFERS') {
            return res.status(400).json({ message: 'This trade is no longer accepting offers' });
        }

        // Check exporter hasn't already submitted an offer for this trade
        const existingOffer = await prisma.marketplaceOffer.findFirst({
            where: { tradeId, exporterId }
        });

        if (existingOffer) {
            return res.status(400).json({ message: 'You have already submitted an offer for this trade' });
        }

        const offer = await prisma.marketplaceOffer.create({
            data: {
                tradeId,
                exporterId,
                amount: parseFloat(amount.toString()),
                shippingTimeline,
                termsAndConditions,
                deliveryTerms: deliveryTerms || 'CIF',
                message: message || null,
                validUntil: validUntil ? new Date(validUntil) : null,
                status: 'PENDING'
            }
        });

        // Log event
        await prisma.tradeEvent.create({
            data: {
                tradeId,
                actorId: exporterId,
                actorRole: 'EXPORTER',
                event: 'OFFER_SUBMITTED',
                toStatus: 'OPEN_FOR_OFFERS',
                metadata: { offerId: offer.id, amount: offer.amount }
            }
        });


        logger.info(`New offer submitted by exporter ${exporterId} for trade ${tradeId}. Amount: ${amount}`);

        res.status(201).json(offer);
    } catch (error: any) {
        console.error("Submit offer error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getOffersForTrade = async (req: Request, res: Response) => {
    try {
        const tradeId = getStringParam(req.params.tradeId);
        const offers = await prisma.marketplaceOffer.findMany({
            where: { tradeId },
            include: {
                exporter: { select: { id: true, name: true, email: true, organizationName: true, country: true } }
            },
            orderBy: { createdAt: 'asc' }
        });
        res.json(offers);
    } catch (error: any) {
        console.error("Get offers error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const finalizeOffer = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const offerId = getStringParam(req.params.offerId);
        const importerId = authReq.user.userId;

        // 1. Get the offer and verify the importer owns the trade
        const offer = await prisma.marketplaceOffer.findUnique({
            where: { id: offerId },
            include: { trade: true }
        });

        if (!offer) {
            return res.status(404).json({ message: "Offer not found" });
        }

        if (offer.trade.importerId !== importerId) {
            return res.status(403).json({ message: "Only the trade creator can accept offers" });
        }

        if (offer.trade.status !== 'OPEN_FOR_OFFERS') {
            return res.status(400).json({ message: "This trade is no longer accepting offers" });
        }

        if (offer.status !== 'PENDING') {
            return res.status(400).json({ message: "This offer is no longer pending" });
        }

        // 2. Transact: Accept this offer, decline others, update trade
        await prisma.$transaction([
            // Accept this offer
            prisma.marketplaceOffer.update({
                where: { id: offerId },
                data: { status: 'ACCEPTED' }
            }),
            // Decline all other pending offers for this trade
            prisma.marketplaceOffer.updateMany({
                where: { tradeId: offer.tradeId, id: { not: offerId }, status: 'PENDING' },
                data: { status: 'DECLINED' }
            }),
            // Update the trade: set exporter, amount, and transition to OFFER_ACCEPTED
            prisma.trade.update({
                where: { id: offer.tradeId },
                data: {
                    status: 'OFFER_ACCEPTED',
                    exporterId: offer.exporterId,
                    amount: offer.amount
                }
            }),
            // Log event
            prisma.tradeEvent.create({
                data: {
                    tradeId: offer.tradeId,
                    actorId: importerId,
                    actorRole: 'IMPORTER',
                    event: 'OFFER_ACCEPTED',
                    fromStatus: 'OPEN_FOR_OFFERS',
                    toStatus: 'OFFER_ACCEPTED',
                    metadata: { offerId: offer.id, exporterId: offer.exporterId, amount: offer.amount }
                }
            })
        ]);

        logger.success(`Offer ${offerId} accepted for trade ${offer.tradeId}. Trade moves to OFFER_ACCEPTED.`);

        res.json({ message: "Offer accepted successfully. Trade moves to OFFER_ACCEPTED." });
    } catch (error: any) {
        console.error("Finalize offer error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const declineOffer = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const offerId = getStringParam(req.params.offerId);
        const importerId = authReq.user.userId;

        const offer = await prisma.marketplaceOffer.findUnique({
            where: { id: offerId },
            include: { trade: true }
        });

        if (!offer) {
            return res.status(404).json({ message: "Offer not found" });
        }

        if (offer.trade.importerId !== importerId) {
            return res.status(403).json({ message: "Only the trade creator can decline offers" });
        }

        if (offer.status !== 'PENDING') {
            return res.status(400).json({ message: "This offer is not in PENDING status" });
        }

        await prisma.marketplaceOffer.update({
            where: { id: offerId },
            data: { status: 'DECLINED' }
        });

        // Log event
        await prisma.tradeEvent.create({
            data: {
                tradeId: offer.tradeId,
                actorId: importerId,
                actorRole: 'IMPORTER',
                event: 'OFFER_DECLINED',
                metadata: { offerId: offer.id, exporterId: offer.exporterId }
            }
        });

        res.json({ message: "Offer declined successfully" });
    } catch (error: any) {
        console.error("Decline offer error:", error);
        res.status(500).json({ message: error.message });
    }
};
