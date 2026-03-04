import { Request, Response } from 'express';
import { prisma } from '../services/PrismaService';

export const createTrade = async (req: Request, res: Response) => {
    try {
        const { exporterId, amount, importerBankId, exporterBankId } = req.body;
        const importerId = (req as any).user.userId;

        const trade = await (prisma.trade as any).create({
            data: {
                amount: parseFloat(amount.toString()),
                status: 'CREATED',
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
                include: { importer: true, importerBank: true, exporterBank: true }
            });
        } else if (role === 'IMPORTER_BANK') {
            trades = await (prisma.trade as any).findMany({
                where: { importerBankId: userId },
                include: { importer: true, exporter: true, exporterBank: true }
            });
        } else if (role === 'EXPORTER_BANK') {
            trades = await (prisma.trade as any).findMany({
                where: { exporterBankId: userId },
                include: { importer: true, exporter: true, importerBank: true }
            });
        } else {
            trades = await (prisma.trade as any).findMany({
                include: { importer: true, exporter: true, importerBank: true, exporterBank: true }
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
                importer: { select: { id: true, name: true, email: true } },
                exporter: { select: { id: true, name: true, email: true } },
                importerBank: true,
                exporterBank: true
            }
        });

        if (!trade) return res.status(404).json({ message: 'Trade not found' });
        res.json(trade);
    } catch (error: any) {
        console.error("Get trade by id error:", error);
        res.status(500).json({ message: error.message });
    }
};
