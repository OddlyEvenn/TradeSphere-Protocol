import { Request, Response } from 'express';
import { prisma } from '../services/PrismaService';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import { getStringParam } from '../utils/request';


/**
 * Shared inclusion object for Trade relations to ensure consistency across endpoints.
 */
const TRADE_INCLUDE = {
    importer: { select: { id: true, name: true, email: true, walletAddress: true } },
    exporter: { select: { id: true, name: true, email: true, walletAddress: true } },
    importerBank: { select: { id: true, name: true, email: true, walletAddress: true } },
    exporterBank: { select: { id: true, name: true, email: true, walletAddress: true } },
    shipping: { select: { id: true, name: true, email: true, walletAddress: true } },
    customs: { select: { id: true, name: true, email: true, walletAddress: true } },
    insurance: { select: { id: true, name: true, email: true, walletAddress: true } },
    letterOfCredit: true,
    billOfLading: true,
    customsVerification: true,
    events: {
        include: {
            actor: { select: { id: true, name: true, walletAddress: true } }
        }
    },
    _count: { select: { offers: true } }
} satisfies Prisma.TradeInclude;

interface AuthUser {
    userId: string;
    role: string;
}

interface AuthRequest extends Request {
    user: AuthUser;
}

export const createTrade = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
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
            priority,
            inspectorId,
            customsOfficerId,
            insuranceId,
            status
        } = req.body;
        
        const importerId = authReq.user.userId;

        const trade = await prisma.trade.create({
            data: {
                amount: parseFloat(amount.toString()),
                status: status || 'QUEUED',
                priority: parseInt(priority?.toString() || '0'),
                productName,
                quantity,
                destination,
                priceRange: priceRange || null,
                shippingDeadline: shippingDeadline ? new Date(shippingDeadline) : null,
                // Using clearanceDeadline as qualityStandards if appropriate, or mapping it correctly
                // clearanceDeadline: clearanceDeadline ? new Date(clearanceDeadline) : null, 
                insuranceRequired: insuranceRequired === true || insuranceRequired === 'true',
                qualityStandards: qualityStandards || null,
                additionalConditions: additionalConditions || null,
                importer: { connect: { id: importerId } },
                ...(exporterId && { exporter: { connect: { id: exporterId } } }),
                ...(importerBankId && { importerBank: { connect: { id: importerBankId } } }),
                ...(exporterBankId && { exporterBank: { connect: { id: exporterBankId } } }),
                ...(inspectorId && { inspector: { connect: { id: inspectorId } } }),
                // Fixing mapping: customsOfficerId used to connect 'customs' relation
                ...(customsOfficerId && { customs: { connect: { id: customsOfficerId } } }),
                ...(insuranceId && { insurance: { connect: { id: insuranceId } } })
            },
            include: TRADE_INCLUDE
        });

        // Create initial trade event
        await prisma.tradeEvent.create({
            data: {
                tradeId: trade.id,
                actorId: importerId,
                actorRole: 'IMPORTER',
                event: 'TRADE_REQUEST_QUEUED',
                fromStatus: null,
                toStatus: trade.status
            }
        });

        res.status(201).json(trade);
    } catch (error: any) {
        logger.error("Create trade error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getMyTrades = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const userId = authReq.user.userId;
        const role = authReq.user.role;

        let whereClause: Prisma.TradeWhereInput = {};

        // Best practice: Use relation filtering instead of scalar IDs to avoid client desync issues
        switch (role) {
            case 'IMPORTER':
                whereClause = { importer: { id: userId } };
                break;
            case 'EXPORTER':
                whereClause = { exporter: { id: userId } };
                break;
            case 'IMPORTER_BANK':
                whereClause = { importerBank: { id: userId } };
                break;
            case 'EXPORTER_BANK':
                whereClause = { exporterBank: { id: userId } };
                break;
            case 'SHIPPING':
                whereClause = { status: { in: ['SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'PAYMENT_AUTHORIZED', 'COMPLETED'] } };
                break;
            case 'CUSTOMS':
                whereClause = { status: { in: ['GOODS_SHIPPED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'CUSTOMS_CLEARED', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'DISPUTE_RESOLVED_NO_REVERT', 'CLAIM_PAYOUT_APPROVED', 'COMPLETED'] } };
                break;
            case 'INSPECTOR':
                whereClause = { 
                    OR: [
                        { inspector: { id: userId } }, 
                        { status: { in: ['GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'DISPUTED', 'DISPUTE_RESOLVED_NO_REVERT', 'CLAIM_PAYOUT_APPROVED', 'COMPLETED'] } }
                    ] 
                };
                break;
            case 'INSURANCE':
                whereClause = { 
                    OR: [
                        { insurance: { id: userId } }, 
                        { status: { in: ['ENTRY_REJECTED', 'VOTING_ACTIVE', 'DISPUTED', 'DISPUTE_RESOLVED_NO_REVERT', 'CLAIM_PAYOUT_APPROVED', 'COMPLETED'] } }
                    ] 
                };
                break;
            default:
                // Any other roles see all trades if they don't have specific filtering
                whereClause = {};
        }

        const trades = await prisma.trade.findMany({
            where: whereClause,
            include: TRADE_INCLUDE,
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json(trades);
    } catch (error: any) {
        logger.error("Get my trades error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getTradeById = async (req: Request, res: Response) => {
    try {
        const id = getStringParam(req.params.id);
        const trade = await prisma.trade.findUnique({
            where: { id },
            include: TRADE_INCLUDE
        });


        if (!trade) return res.status(404).json({ message: 'Trade not found' });
        res.json(trade);
    } catch (error: any) {
        logger.error("Get trade by id error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getMarketplaceTrades = async (req: Request, res: Response) => {
    try {
        const trades = await prisma.trade.findMany({
            where: { status: 'OPEN_FOR_OFFERS' },
            include: {
                importer: { select: { id: true, name: true } },
                _count: { select: { offers: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(trades);
    } catch (error: any) {
        logger.error("Get marketplace trades error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getTradeEvents = async (req: Request, res: Response) => {
    try {
        const id = getStringParam(req.params.id);
        const events = await prisma.tradeEvent.findMany({
            where: { tradeId: id },
            include: {
                actor: { select: { id: true, name: true, role: true } }
            },
            orderBy: { createdAt: 'asc' }
        });
        res.json(events);
    } catch (error: any) {
        logger.error("Get trade events error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const updateTrade = async (req: Request, res: Response) => {
    try {
        const id = getStringParam(req.params.id);
        const updates = req.body;

        if (updates.blockchainId !== undefined && updates.blockchainId !== null) {
            const bcId = Number(updates.blockchainId);
            const staleTrade = await prisma.trade.findUnique({
                where: { blockchainId: bcId }
            });

            if (staleTrade && staleTrade.id !== id) {
                logger.warn(`⚠️  Manual push: Blockchain ID #${bcId} was assigned to STALE trade ${staleTrade.id}. Un-mapping.`);
                await prisma.trade.update({
                    where: { id: staleTrade.id },
                    data: { blockchainId: null }
                });
            }
        }

        const trade = await prisma.trade.update({
            where: { id },
            data: updates,
        });

        res.json(trade);
    } catch (error: any) {
        logger.error("Update trade error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const deleteTrade = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const id = getStringParam(req.params.id);
        const userId = authReq.user.userId;

        const trade = await prisma.trade.findUnique({
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

        // Transactional delete to ensure consistency
        await prisma.$transaction([
            prisma.tradeEvent.deleteMany({ where: { tradeId: id } }),
            prisma.marketplaceOffer.deleteMany({ where: { tradeId: id } }),
            prisma.trade.delete({ where: { id } })
        ]);

        res.status(200).json({ message: 'Trade deleted successfully' });
    } catch (error: any) {
        logger.error("Delete trade error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const updateTradeState = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const id = getStringParam(req.params.id);
        const { status, txHash, ipfsHash, eventName, taxAmount } = req.body;

        const userId = authReq.user.userId;
        const role = authReq.user.role;

        const STATUS_CHANGING_ACTIONS = ['CUSTOMS_DECISION'];

        if (status && !txHash && !STATUS_CHANGING_ACTIONS.includes(eventName || '')) {
            logger.warn(`🚫 REJECTED direct DB status update for trade ${id}. Missing txHash.`);
            return res.status(400).json({
                message: `BLOCKCHAIN ENFORCEMENT: Trade status changes must originate from a blockchain transaction.`,
                code: 'MISSING_TX_HASH'
            });
        }

        if (txHash) {
            logger.transaction({
                event: eventName || "FrontendStateRecord",
                txHash,
                dbId: id,
                actor: `${role} (${userId})`,
                status: status
            });
        }

        const trade = await prisma.trade.findUnique({ where: { id } });
        if (!trade) return res.status(404).json({ message: 'Trade not found' });

        const updateData: Prisma.TradeUpdateInput = {};
        if (status && txHash) updateData.status = status;

        const updatedTrade = await prisma.trade.update({
            where: { id },
            data: updateData
        });

        await prisma.tradeEvent.create({
            data: {
                tradeId: id,
                actorId: userId,
                actorRole: role,
                event: eventName || status || 'TRADE_RECORD_UPDATED',
                fromStatus: trade.status,
                toStatus: (updateData.status as string) || trade.status,
                txHash: txHash || null,
                ipfsHash: ipfsHash || null
            }
        });

        res.json({ message: `Trade record updated`, trade: updatedTrade });
    } catch (error: any) {
        logger.error("Update trade state error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getVotingSummary = async (req: Request, res: Response) => {
    try {
        const id = getStringParam(req.params.id);
        const { blockchainService } = await import('../services/BlockchainService');

        const trade = await prisma.trade.findUnique({
            where: { id },
            include: TRADE_INCLUDE
        });

        if (!trade || !trade.blockchainId) {
            return res.status(404).json({ message: 'Trade or Blockchain ID not found' });
        }

        const contract = blockchainService.consensusDispute;
        const summary = await contract.getVotingSummary(trade.blockchainId);
        const decision = await contract.getInspectorDecision(trade.blockchainId);

        res.json({
            trade,
            voting: {
                active: summary[0],
                finalized: summary[1],
                votingDeadline: Number(summary[2]),
                revertVotes: Number(summary[3]),
                noRevertVotes: Number(summary[4]),
                totalVotesCast: Number(summary[5])
            },
            inspectorDecision: {
                submitted: decision[0],
                decision: decision[1],
                cargoStatus: Number(decision[2]),
                notes: decision[3]
            }
        });
    } catch (error: any) {
        logger.error("Get voting summary error:", error);
        res.status(500).json({ message: error.message });
    }
};
