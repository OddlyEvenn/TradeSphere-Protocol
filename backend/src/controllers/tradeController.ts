import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

export const createTrade = async (req: Request, res: Response) => {
    try {
        const { exporterId, amount } = req.body;
        const importerId = (req as any).user.userId; // Populated by auth middleware

        const trade = await prisma.trade.create({
            data: {
                importerId,
                exporterId,
                amount: parseFloat(amount),
                status: 'CREATED'
            }
        });

        res.status(201).json(trade);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getMyTrades = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const role = (req as any).user.role;

        let trades;
        if (role === 'IMPORTER') {
            trades = await prisma.trade.findMany({ where: { importerId: userId }, include: { importer: true } });
        } else {
            // For now, simplicity
            trades = await prisma.trade.findMany({ where: { exporterId: userId } });
        }

        res.status(200).json(trades);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getTradeById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const trade = await prisma.trade.findUnique({
            where: { id: id as string },
            include: { importer: true }
        });
        if (!trade) return res.status(404).json({ message: 'Trade not found' });
        res.json(trade);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
