import { blockchainService } from "./BlockchainService";
import { prisma } from "./PrismaService";
import { logger } from "../utils/logger";

export class EventListenerService {
    public static async startListeners() {
        logger.info("📡 [EventListenerService] Starting Phase 2 Blockchain Listeners...");

        // Helper to safely get DB tradeId from blockchainId
        const getTradeId = async (blockchainId: number) => {
            const trade = await (prisma.trade as any).findUnique({ where: { blockchainId } });
            return trade ? trade.id : null;
        };

        // 1. TradeCreated
        blockchainService.tradeRegistry.on(
            "TradeCreated",
            async (tradeId: any, importerAddr: any, exporterAddr: any, amount: any, event: any) => {
                const txHash = event.log.transactionHash;
                logger.transaction({
                    event: "TradeCreated",
                    txHash,
                    blockchainId: Number(tradeId),
                    actor: `Importer: ${importerAddr}`
                });

                try {
                    const importer = await (prisma.user as any).findUnique({ where: { walletAddress: importerAddr.toLowerCase() } });
                    const parsedAmount = parseFloat(blockchainService.formatEther(amount));

                    const trades = await (prisma.trade as any).findMany({
                        where: {
                            blockchainId: null,
                            amount: parsedAmount,
                            importerId: importer?.id,
                        },
                        orderBy: { createdAt: 'desc' }
                    });

                    if (trades.length > 0) {
                        const tradeToSync = trades[0];
                        await (prisma.trade as any).update({
                            where: { id: tradeToSync.id },
                            data: { blockchainId: Number(tradeId) }
                        });

                        await (prisma.tradeEvent as any).create({
                            data: {
                                tradeId: tradeToSync.id,
                                actorId: importer?.id || null,
                                actorRole: 'IMPORTER',
                                event: 'ON_CHAIN_TRADE_CREATED',
                                txHash: txHash
                            }
                        });
                        logger.success(`Synced Trade ${tradeId} to Database (UUID: ${tradeToSync.id}).`);
                    }
                } catch (error) {
                    logger.error(`Error syncing TradeCreated for ${tradeId}:`, error);
                }
            }
        );

        // 2. TradeStatusUpdated (Central State Machine)
        blockchainService.tradeRegistry.on(
            "TradeStatusUpdated",
            async (tradeId: any, oldStatus: any, newStatus: any, event: any) => {
                const txHash = event.log.transactionHash;
                const statusMap: Record<number, string> = {
                    0: "OFFER_ACCEPTED", 1: "TRADE_INITIATED", 2: "LOC_INITIATED",
                    3: "LOC_UPLOADED", 4: "LOC_APPROVED", 5: "FUNDS_LOCKED",
                    6: "GOODS_SHIPPED", 7: "CUSTOMS_CLEARED", 8: "DUTY_PENDING",
                    9: "DUTY_PAID", 10: "PAYMENT_AUTHORIZED", 11: "SETTLEMENT_CONFIRMED",
                    12: "COMPLETED", 13: "DISPUTED", 14: "EXPIRED"
                };

                const statusString = statusMap[Number(newStatus)] || "UNKNOWN";

                logger.transaction({
                    event: "TradeStatusUpdated",
                    txHash,
                    blockchainId: Number(tradeId),
                    status: `${oldStatus} -> ${statusString}`
                });

                const dbTradeId = await getTradeId(Number(tradeId));
                if (!dbTradeId) {
                    logger.warn(`No DB matching for Blockchain Trade ID: ${tradeId}`);
                    return;
                }

                try {
                    await (prisma.trade as any).update({
                        where: { id: dbTradeId },
                        data: { status: statusString },
                    });
                    logger.success(`Updated Trade ${tradeId} status to ${statusString} in DB.`);
                } catch (error) {
                    logger.error(`Error syncing TradeStatusUpdated:`, error);
                }
            }
        );

        // 3. LoCDocumentUploaded (Contains IPFS Hash)
        blockchainService.letterOfCredit.on(
            "LoCDocumentUploaded",
            async (tradeId: any, ipfsHash: any, uploadedBy: any, event: any) => {
                const txHash = event.log.transactionHash;
                logger.transaction({
                    event: "LoCDocumentUploaded",
                    txHash,
                    blockchainId: Number(tradeId),
                    actor: `Bank: ${uploadedBy}`
                });

                const dbTradeId = await getTradeId(Number(tradeId));
                if (!dbTradeId) return;

                const bank = await (prisma.user as any).findUnique({ where: { walletAddress: uploadedBy.toLowerCase() } });

                try {
                    await (prisma.tradeEvent as any).create({
                        data: {
                            tradeId: dbTradeId,
                            actorId: bank?.id || null,
                            actorRole: 'IMPORTER_BANK',
                            event: 'LOC_UPLOADED',
                            ipfsHash: ipfsHash as any,
                            txHash: txHash as any
                        }
                    });
                    logger.success(`Logged LoC Upload for Trade ${tradeId}. IPFS: ${ipfsHash}`);
                } catch (error) {
                    logger.error(`Error logging LoCDocumentUploaded:`, error);
                }
            }
        );

        // 4. BillOfLadingIssued (Contains IPFS Hash)
        blockchainService.documentVerification.on(
            "BillOfLadingIssued",
            async (tradeId: any, ipfsHash: any, issuedBy: any, event: any) => {
                const txHash = event.log.transactionHash;
                logger.transaction({
                    event: "BillOfLadingIssued",
                    txHash,
                    blockchainId: Number(tradeId),
                    actor: `Shipping: ${issuedBy}`
                });

                const dbTradeId = await getTradeId(Number(tradeId));
                if (!dbTradeId) return;

                const shipper = await (prisma.user as any).findUnique({ where: { walletAddress: issuedBy.toLowerCase() } });

                try {
                    await (prisma.tradeEvent as any).create({
                        data: {
                            tradeId: dbTradeId,
                            actorId: shipper?.id || null,
                            actorRole: 'SHIPPING',
                            event: 'GOODS_SHIPPED',
                            ipfsHash: ipfsHash as any,
                            txHash: txHash as any
                        }
                    });
                    logger.success(`Logged BoL Issuance for Trade ${tradeId}. IPFS: ${ipfsHash}`);
                } catch (error) {
                    logger.error(`Error logging BillOfLadingIssued:`, error);
                }
            }
        );

        // 5. CustomsDecision
        blockchainService.documentVerification.on(
            "CustomsDecision",
            async (tradeId: any, cleared: any, decidedBy: any, event: any) => {
                const txHash = event.log.transactionHash;
                logger.transaction({
                    event: "CustomsDecision",
                    txHash,
                    blockchainId: Number(tradeId),
                    status: cleared ? "CLEARED" : "DUTY_PENDING",
                    actor: `Customs: ${decidedBy}`
                });

                const dbTradeId = await getTradeId(Number(tradeId));
                if (!dbTradeId) return;

                const customs = await (prisma.user as any).findUnique({ where: { walletAddress: decidedBy.toLowerCase() } });

                try {
                    await (prisma.tradeEvent as any).create({
                        data: {
                            tradeId: dbTradeId,
                            actorId: customs?.id || null,
                            actorRole: 'CUSTOMS',
                            event: cleared ? 'CUSTOMS_CLEARED' : 'DUTY_PENDING',
                            txHash: txHash
                        }
                    });
                    logger.success(`Logged Customs Decision for Trade ${tradeId}.`);
                } catch (error) {
                    logger.error(`Error logging CustomsDecision:`, error);
                }
            }
        );

        // 6. PaymentSettlement Events
        blockchainService.paymentSettlement.on("PaymentAuthorized", async (tradeId: any, amount: any, authorizedBy: any, event: any) => {
            const txHash = event.log.transactionHash;
            logger.transaction({
                event: "PaymentAuthorized",
                txHash,
                blockchainId: Number(tradeId),
                actor: `Authorizer: ${authorizedBy}`
            });

            const dbTradeId = await getTradeId(Number(tradeId));
            if (!dbTradeId) return;

            try {
                await (prisma.tradeEvent as any).create({ data: { tradeId: dbTradeId, event: 'PAYMENT_AUTHORIZED', txHash: txHash as any } });
                logger.success(`Logged Payment Authorization for Trade ${tradeId}.`);
            } catch (error) {
                logger.error(`Error logging PaymentAuthorized:`, error);
            }
        });

        blockchainService.paymentSettlement.on("SettlementConfirmed", async (tradeId: any, confirmedBy: any, event: any) => {
            const txHash = event.log.transactionHash;
            logger.transaction({
                event: "SettlementConfirmed",
                txHash,
                blockchainId: Number(tradeId),
                actor: `Confirmer: ${confirmedBy}`
            });

            const dbTradeId = await getTradeId(Number(tradeId));
            if (!dbTradeId) return;

            try {
                await (prisma.tradeEvent as any).create({ data: { tradeId: dbTradeId, event: 'SETTLEMENT_CONFIRMED', txHash: txHash as any } });
                logger.success(`Logged Settlement Confirmation for Trade ${tradeId}.`);
            } catch (error) {
                logger.error(`Error logging SettlementConfirmed:`, error);
            }
        });

        logger.info("📡 Listeners are active and watching Hardhat Node...");
    }
}

