import { Request, Response } from 'express';
import { prisma } from '../services/PrismaService';

export const createTrade = async (req: Request, res: Response) => {
    try {
        const {
            exporterId,
            amount,
            importerBankId,
            exporterBankId,
            productName,
            quantity,
            destination,
            priceRange,
            shippingDeadline,
            insuranceRequired,
            qualityStandards,
            additionalConditions,
            status
        } = req.body;
        const importerId = (req as any).user.userId;

        const trade = await (prisma.trade as any).create({
            data: {
                amount: parseFloat(amount.toString()),
                status: status || 'OPEN_FOR_OFFERS',
                productName,
                quantity,
                destination,
                priceRange: priceRange || null,
                shippingDeadline: shippingDeadline ? new Date(shippingDeadline) : null,
                insuranceRequired: insuranceRequired === true || insuranceRequired === 'true',
                qualityStandards: qualityStandards || null,
                additionalConditions: additionalConditions || null,
                importer: { connect: { id: importerId } },
                ...(exporterId && { exporter: { connect: { id: exporterId } } }),
                ...(importerBankId && { importerBank: { connect: { id: importerBankId } } }),
                ...(exporterBankId && { exporterBank: { connect: { id: exporterBankId } } })
            }
        });

        // Create initial trade event
        await (prisma.tradeEvent as any).create({
            data: {
                tradeId: trade.id,
                actorId: importerId,
                actorRole: 'IMPORTER',
                event: 'TRADE_REQUEST_CREATED',
                fromStatus: null,
                toStatus: 'OPEN_FOR_OFFERS'
            }
        });

        res.status(201).json(trade);
    } catch (error: any) {
        console.error("Create trade error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getMyTrades = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const role = (req as any).user.role;

        let trades;
        const includeBase = {
            importer: { select: { id: true, name: true, email: true, walletAddress: true } },
            exporter: { select: { id: true, name: true, email: true, walletAddress: true } },
            importerBank: { select: { id: true, name: true, email: true, walletAddress: true } },
            exporterBank: { select: { id: true, name: true, email: true, walletAddress: true } },
            shipping: { select: { id: true, name: true, email: true, walletAddress: true } },
            letterOfCredit: true,
            _count: { select: { offers: true } }
        };

        if (role === 'IMPORTER') {
            trades = await (prisma.trade as any).findMany({
                where: { importerId: userId },
                include: includeBase,
                orderBy: { createdAt: 'desc' }
            });
        } else if (role === 'EXPORTER') {
            trades = await (prisma.trade as any).findMany({
                where: { exporterId: userId },
                include: includeBase,
                orderBy: { createdAt: 'desc' }
            });
        } else if (role === 'IMPORTER_BANK') {
            trades = await (prisma.trade as any).findMany({
                where: { importerBankId: userId },
                include: includeBase,
                orderBy: { createdAt: 'desc' }
            });
        } else if (role === 'EXPORTER_BANK') {
            trades = await (prisma.trade as any).findMany({
                where: { exporterBankId: userId },
                include: includeBase,
                orderBy: { createdAt: 'desc' }
            });
        } else if (role === 'SHIPPING') {
            trades = await (prisma.trade as any).findMany({
                where: { shippingId: userId },
                include: includeBase,
                orderBy: { createdAt: 'desc' }
            });
        } else if (role === 'CUSTOMS') {
            trades = await (prisma.trade as any).findMany({
                where: { customsOfficerId: userId },
                include: includeBase,
                orderBy: { createdAt: 'desc' }
            });
        } else if (role === 'TAX_AUTHORITY') {
            trades = await (prisma.trade as any).findMany({
                where: { taxAuthorityId: userId },
                include: includeBase,
                orderBy: { createdAt: 'desc' }
            });
        } else {
            // REGULATORS and other roles see all trades
            trades = await (prisma.trade as any).findMany({
                include: includeBase,
                orderBy: { createdAt: 'desc' }
            });
        }

        res.status(200).json(trades);
    } catch (error: any) {
        console.error("Get my trades error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getTradeById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const trade = await (prisma.trade as any).findUnique({
            where: { id: id as string },
            include: {
                importer: { select: { id: true, name: true, email: true, walletAddress: true } },
                exporter: { select: { id: true, name: true, email: true, walletAddress: true } },
                importerBank: { select: { id: true, name: true, email: true, walletAddress: true } },
                exporterBank: { select: { id: true, name: true, email: true, walletAddress: true } },
                shipping: { select: { id: true, name: true, email: true, walletAddress: true } },
                customs: { select: { id: true, name: true, email: true } },
                taxAuthority: { select: { id: true, name: true, email: true } },
                letterOfCredit: true,
                billOfLading: true,
                customsVerification: true,
                dutyAssessment: true,
                _count: { select: { offers: true } }
            }
        });

        if (!trade) return res.status(404).json({ message: 'Trade not found' });
        res.json(trade);
    } catch (error: any) {
        console.error("Get trade by id error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getMarketplaceTrades = async (req: Request, res: Response) => {
    try {
        const trades = await (prisma.trade as any).findMany({
            where: { status: 'OPEN_FOR_OFFERS' },
            include: {
                importer: { select: { id: true, name: true } },
                _count: { select: { offers: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(trades);
    } catch (error: any) {
        console.error("Get marketplace trades error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getTradeEvents = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const events = await (prisma.tradeEvent as any).findMany({
            where: { tradeId: id },
            include: {
                actor: { select: { id: true, name: true, role: true } }
            },
            orderBy: { createdAt: 'asc' }
        });
        res.json(events);
    } catch (error: any) {
        console.error("Get trade events error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const updateTrade = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const trade = await (prisma.trade as any).update({
            where: { id },
            data: updates,
        });

        res.json(trade);
    } catch (error: any) {
        console.error("Update trade error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const deleteTrade = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.userId;

        const trade = await (prisma.trade as any).findUnique({
            where: { id }
        });

        if (!trade) {
            return res.status(404).json({ message: 'Trade not found' });
        }

        if (trade.importerId !== userId) {
            return res.status(403).json({ message: 'Only the creator can delete this trade' });
        }

        if (trade.status !== 'OPEN_FOR_OFFERS') {
            return res.status(400).json({ message: `Cannot delete trade with status: ${trade.status}` });
        }

        // Delete associated records first
        await (prisma.tradeEvent as any).deleteMany({ where: { tradeId: id } });
        await (prisma.marketplaceOffer as any).deleteMany({ where: { tradeId: id } });

        await (prisma.trade as any).delete({
            where: { id }
        });

        res.status(200).json({ message: 'Trade deleted successfully' });
    } catch (error: any) {
        console.error("Delete trade error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const updateTradeState = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, txHash, ipfsHash, eventName } = req.body;
        const userId = (req as any).user.userId;
        const role = (req as any).user.role;

        const trade = await (prisma.trade as any).findUnique({ where: { id } });
        if (!trade) return res.status(404).json({ message: 'Trade not found' });

        const updatedTrade = await (prisma.trade as any).update({
            where: { id },
            data: { status }
        });

        await (prisma.tradeEvent as any).create({
            data: {
                tradeId: id,
                actorId: userId,
                actorRole: role,
                event: eventName || status,
                fromStatus: trade.status,
                toStatus: status,
                txHash: txHash || null,
                ipfsHash: ipfsHash || null
            }
        });

        res.json({ message: `Trade status updated to ${status}`, trade: updatedTrade });
    } catch (error: any) {
        console.error("Update trade state error:", error);
        res.status(500).json({ message: error.message });
    }
};
