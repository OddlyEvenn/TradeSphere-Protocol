import { Request, Response } from 'express';
import { prisma } from '../services/PrismaService';
import { logger } from '../utils/logger';

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
            clearanceDeadline,
            insuranceRequired,
            qualityStandards,
            additionalConditions,
            status,
            priority,
            inspectorId,
            customsOfficerId,
            insuranceId
        } = req.body;
        const importerId = (req as any).user.userId;

        const trade = await (prisma.trade as any).create({
            data: {
                amount: parseFloat(amount.toString()),
                status: status || 'QUEUED',
                priority: parseInt(priority?.toString() || '0'),
                productName,
                quantity,
                destination,
                priceRange: priceRange || null,
                shippingDeadline: shippingDeadline ? new Date(shippingDeadline) : null,
                clearanceDeadline: clearanceDeadline ? new Date(clearanceDeadline) : null,
                insuranceRequired: insuranceRequired === true || insuranceRequired === 'true',
                qualityStandards: qualityStandards || null,
                additionalConditions: additionalConditions || null,
                importer: { connect: { id: importerId } },
                ...(exporterId && { exporter: { connect: { id: exporterId } } }),
                ...(importerBankId && { importerBank: { connect: { id: importerBankId } } }),
                ...(exporterBankId && { exporterBank: { connect: { id: exporterBankId } } }),
                ...(inspectorId && { inspector: { connect: { id: inspectorId } } }),
                ...(customsOfficerId && { customs: { connect: { id: customsOfficerId } } }),
                ...(insuranceId && { insurance: { connect: { id: insuranceId } } })
            }
        });

        // Create initial trade event
        await (prisma.tradeEvent as any).create({
            data: {
                tradeId: trade.id,
                actorId: importerId,
                actorRole: 'IMPORTER',
                event: 'TRADE_REQUEST_QUEUED',
                fromStatus: null,
                toStatus: status || 'QUEUED'
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
            inspector: { select: { id: true, name: true, email: true, walletAddress: true } },
            customs: { select: { id: true, name: true, email: true, walletAddress: true } },
            insurance: { select: { id: true, name: true, email: true, walletAddress: true } },
            taxAuthority: { select: { id: true, name: true, email: true, walletAddress: true } },
            letterOfCredit: true,
            billOfLading: true,
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
            // Shipping sees all trades that need dispatch or are in transit
            trades = await (prisma.trade as any).findMany({
                where: { status: { in: ['SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'DUTY_PENDING', 'DUTY_PAID', 'PAYMENT_AUTHORIZED', 'COMPLETED'] } },
                include: includeBase,
                orderBy: { createdAt: 'desc' }
            });
        } else if (role === 'CUSTOMS') {
            // Customs sees all trades that are in shipment/clearance statuses
            trades = await (prisma.trade as any).findMany({
                where: { status: { in: ['GOODS_SHIPPED', 'DUTY_PENDING', 'DUTY_PAID', 'CUSTOMS_CLEARED', 'PAYMENT_AUTHORIZED', 'COMPLETED'] } },
                include: includeBase,
                orderBy: { createdAt: 'desc' }
            });
        } else if (role === 'TAX_AUTHORITY') {
            // Tax authority sees all trades with duty pending
            trades = await (prisma.trade as any).findMany({
                where: { status: { in: ['DUTY_PENDING', 'DUTY_PAID', 'CUSTOMS_CLEARED', 'PAYMENT_AUTHORIZED', 'COMPLETED'] } },
                include: includeBase,
                orderBy: { createdAt: 'desc' }
            });
        } else if (role === 'INSPECTOR') {
            trades = await (prisma.trade as any).findMany({
                where: { OR: [{ inspectorId: userId }, { status: { in: ['GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'DISPUTED', 'TRADE_REVERTED_BY_CONSENSUS', 'COMPLETED'] } }] },
                include: includeBase,
                orderBy: { createdAt: 'desc' }
            });
        } else if (role === 'INSURANCE') {
            trades = await (prisma.trade as any).findMany({
                where: { OR: [{ insuranceId: userId }, { status: { in: ['GOODS_SHIPPED', 'DISPUTED', 'CLAIM_PAYOUT_APPROVED', 'TRADE_REVERTED_BY_CONSENSUS', 'COMPLETED'] } }] },
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

        // ─── STALE ID CLEANUP (FOR MANUAL PUSH) ───────────────────────────
        // If frontend manually pushes a blockchainId, we must ensure it's not 
        // already taken by a stale record.
        if (updates.blockchainId !== undefined && updates.blockchainId !== null) {
            const bcId = Number(updates.blockchainId);
            const staleTrade = await (prisma.trade as any).findUnique({
                where: { blockchainId: bcId }
            });

            if (staleTrade && staleTrade.id !== id) {
                logger.warn(`⚠️  Manual push: Blockchain ID #${bcId} was assigned to STALE trade ${staleTrade.id}. Un-mapping.`);
                await (prisma.trade as any).update({
                    where: { id: staleTrade.id },
                    data: { blockchainId: null }
                });
            }
        }
        // ──────────────────────────────────────────────────────────────

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
        const status = req.body.status as string | undefined;
        const txHash = req.body.txHash as string | undefined;
        const ipfsHash = req.body.ipfsHash as string | undefined;
        const eventName = req.body.eventName as string | undefined;
        const taxAmount = req.body.taxAmount;

        const userId = (req as any).user.userId;
        const role = (req as any).user.role;

        // ─── ARCHITECTURE ENFORCEMENT ──────────────────────────────────────
        // Trade status transitions ONLY happen through blockchain events.
        // The EventListenerService listens to on-chain events and updates the DB.
        // This endpoint is for recording satellite data only (dutyAmount, eventName).
        //
        // EXCEPTION: a txHash MUST accompany any status change requested here.
        // This ensures the DB change is backed by a real blockchain transaction.
        // ──────────────────────────────────────────────────────────────────────
        const STATUS_CHANGING_ACTIONS = [
            'DUTY_ASSESSED',    // Tax authority assesses duty amount (off-chain input, on-chain record)
        ];

        // If caller is trying to change status without a txHash, reject it.
        // Status must come from EventListenerService (on-chain event) EXCEPT for special off-chain helpers.
        if (status && !txHash && !STATUS_CHANGING_ACTIONS.includes(eventName || '')) {
            logger.warn(
                `🚫 REJECTED direct DB status update for trade ${id}. ` +
                `Status "${status}" must originate from a blockchain transaction. Missing txHash.`
            );
            return res.status(400).json({
                message: `BLOCKCHAIN ENFORCEMENT: Trade status changes must originate from a blockchain transaction. ` +
                    `Please submit the on-chain transaction first. The EventListenerService will update the database automatically.`,
                code: 'MISSING_TX_HASH'
            });
        }

        if (txHash) {
            logger.transaction({
                event: (eventName as any) || "FrontendStateRecord",
                txHash,
                dbId: id as string,
                actor: `${role} (${userId})`,
                status: status as any
            });
        }

        const trade = await (prisma.trade as any).findUnique({ where: { id } });
        if (!trade) return res.status(404).json({ message: 'Trade not found' });

        // Only record satellite / auxiliary data — never mutate status unless txHash is present
        const updateData: any = {};
        if (status && txHash) updateData.status = status as any; // backed by blockchain tx
        if (taxAmount !== undefined && taxAmount !== null) updateData.dutyAmount = parseFloat(taxAmount);

        const updatedTrade = await (prisma.trade as any).update({
            where: { id },
            data: updateData as any
        });

        // Create a TradeEvent audit record
        await (prisma.tradeEvent as any).create({
            data: {
                tradeId: id,
                actorId: userId,
                actorRole: role,
                event: (eventName as any) || (status as any) || 'TRADE_RECORD_UPDATED',
                fromStatus: trade.status,
                toStatus: (updateData.status as any) || trade.status,
                txHash: (txHash as any) || null,
                ipfsHash: (ipfsHash as any) || null
            } as any
        });

        const newStatus = updateData.status || trade.status;
        logger.success(`Trade ${id} — satellite data recorded. Status: ${trade.status} → ${newStatus}`);
        res.json({ message: `Trade record updated`, trade: updatedTrade });
    } catch (error: any) {
        logger.error("Update trade state error:", error);
        res.status(500).json({ message: error.message });
    }
};
