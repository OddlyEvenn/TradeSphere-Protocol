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
            shippingDeadline,
            insuranceRequired,
            additionalConditions,
            status
        } = req.body;
        const importerId = (req as any).user.userId;

        const trade = await (prisma.trade as any).create({
            data: {
                amount: parseFloat(amount.toString()),
                status: status || 'CREATED',
                productName,
                quantity,
                destination,
                shippingDeadline: shippingDeadline ? new Date(shippingDeadline) : null,
                insuranceRequired: insuranceRequired === true || insuranceRequired === 'true',
                additionalConditions,
                importer: { connect: { id: importerId } },
                ...(exporterId && { exporter: { connect: { id: exporterId } } }),
                ...(importerBankId && { importerBank: { connect: { id: importerBankId } } }),
                ...(exporterBankId && { exporterBank: { connect: { id: exporterBankId } } })
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
        if (role === 'IMPORTER') {
            trades = await (prisma.trade as any).findMany({
                where: { importerId: userId },
                include: { exporter: true, importerBank: true, exporterBank: true }
            });
        } else if (role === 'EXPORTER') {
            trades = await (prisma.trade as any).findMany({
                where: { exporterId: userId },
                include: { importer: true, importerBank: true, exporterBank: true, shipping: true }
            });
        } else if (role === 'IMPORTER_BANK') {
            trades = await (prisma.trade as any).findMany({
                where: { importerBankId: userId },
                include: { importer: true, exporter: true, exporterBank: true, shipping: true }
            });
        } else if (role === 'EXPORTER_BANK') {
            trades = await (prisma.trade as any).findMany({
                where: { exporterBankId: userId },
                include: { importer: true, exporter: true, importerBank: true, shipping: true }
            });
        } else if (role === 'SHIPPING') {
            trades = await (prisma.trade as any).findMany({
                where: { shippingId: userId },
                include: { importer: true, exporter: true, importerBank: true, exporterBank: true }
            });
        } else {
            trades = await (prisma.trade as any).findMany({
                include: { importer: true, exporter: true, importerBank: true, exporterBank: true, shipping: true }
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
                exporterBank: { select: { id: true, name: true, email: true, walletAddress: true } }
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
                importer: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(trades);
    } catch (error: any) {
        console.error("Get marketplace trades error:", error);
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

        // Check if trade exists
        const trade = await (prisma.trade as any).findUnique({
            where: { id }
        });

        if (!trade) {
            return res.status(404).json({ message: 'Trade not found' });
        }

        // Only importer who created it can delete it
        if (trade.importerId !== userId) {
            return res.status(403).json({ message: 'Only the creator can delete this trade' });
        }

        // Only allow deletion if no serious progress has been made
        if (trade.status !== 'OPEN_FOR_OFFERS' && trade.status !== 'CREATED') {
            return res.status(400).json({ message: `Cannot delete trade with status: ${trade.status}` });
        }

        // Delete associated offers first to avoid foreign key constraints
        await (prisma.marketplaceOffer as any).deleteMany({
            where: { tradeId: id }
        });

        // Delete the trade
        await (prisma.trade as any).delete({
            where: { id }
        });

        res.status(200).json({ message: 'Trade deleted successfully' });
    } catch (error: any) {
        console.error("Delete trade error:", error);
        res.status(500).json({ message: error.message });
    }
};
