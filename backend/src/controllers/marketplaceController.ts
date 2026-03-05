import { Request, Response } from 'express';
import { prisma } from '../services/PrismaService';

export const createListing = async (req: Request, res: Response) => {
    try {
        const { productId, price, quantity } = req.body;
        const exporterId = (req as any).user.userId;

        const listing = await (prisma.marketplaceListing as any).create({
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
        const listings = await (prisma.marketplaceListing as any).findMany({
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
        const { tradeId, amount, message } = req.body;
        const exporterId = (req as any).user.userId;

        const offer = await (prisma.marketplaceOffer as any).create({
            data: {
                tradeId,
                exporterId,
                amount: parseFloat(amount),
                message,
                status: 'PENDING'
            }
        });

        res.status(201).json(offer);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getOffersForTrade = async (req: Request, res: Response) => {
    try {
        const { tradeId } = req.params;
        const offers = await (prisma.marketplaceOffer as any).findMany({
            where: { tradeId },
            include: {
                exporter: { select: { id: true, name: true } }
            }
        });
        res.json(offers);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const finalizeOffer = async (req: Request, res: Response) => {
    try {
        const { offerId } = req.params;
        const importerId = (req as any).user.userId;

        // 1. Get the offer and verify the importer owns the trade
        const offer = await (prisma.marketplaceOffer as any).findUnique({
            where: { id: offerId },
            include: { trade: true }
        });

        if (!offer || offer.trade.importerId !== importerId) {
            return res.status(403).json({ message: "Unauthorized or offer not found" });
        }

        // 2. Transact: Accept this offer, reject others, update trade
        await (prisma as any).$transaction([
            // Update this offer to ACCEPTED
            (prisma.marketplaceOffer as any).update({
                where: { id: offerId },
                data: { status: 'ACCEPTED' }
            }),
            // Reject all other offers for this trade
            (prisma.marketplaceOffer as any).updateMany({
                where: { tradeId: offer.tradeId, id: { not: offerId } },
                data: { status: 'REJECTED' }
            }),
            // Update the trade with the exporter details and status
            (prisma.trade as any).update({
                where: { id: offer.tradeId },
                data: {
                    status: 'CREATED', // Transition from OPEN_FOR_OFFERS to CREATED
                    exporterId: offer.exporterId,
                    amount: offer.amount
                }
            })
        ]);

        res.json({ message: "Offer finalized successfully" });
    } catch (error: any) {
        console.error("Finalize offer error:", error);
        res.status(500).json({ message: error.message });
    }
};
