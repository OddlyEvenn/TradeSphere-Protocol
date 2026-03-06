import { blockchainService } from "./BlockchainService";
import { prisma } from "./PrismaService";

export class EventListenerService {
    public static async startListeners() {
        console.log("📡 [EventListenerService] Starting Phase 2 Blockchain Listeners...");

        // Helper to safely get DB tradeId from blockchainId
        const getTradeId = async (blockchainId: number) => {
            const trade = await (prisma.trade as any).findUnique({ where: { blockchainId } });
            return trade ? trade.id : null;
        };

        // 1. TradeCreated
        blockchainService.tradeRegistry.on(
            "TradeCreated",
            async (tradeId: any, importerAddr: any, exporterAddr: any, amount: any, event: any) => {
                console.log(`[TradeCreated] On-chain ID: ${tradeId}, Importer: ${importerAddr}, Exporter: ${exporterAddr}`);
                try {
                    const importer = await (prisma.user as any).findUnique({ where: { walletAddress: importerAddr.toLowerCase() } });

                    // Link the blockchain ID to the database record using importer and amount
                    // (Assuming the trade was created via API first and now syncing on-chain ID)
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
                                txHash: event.log.transactionHash
                            }
                        });
                        console.log(`✅ Synced Trade ${tradeId} to Database (UUID: ${tradeToSync.id}).`);
                    }
                } catch (error) {
                    console.error(`❌ Error syncing TradeCreated:`, error);
                }
            }
        );

        // 2. TradeStatusUpdated (Central State Machine)
        blockchainService.tradeRegistry.on(
            "TradeStatusUpdated",
            async (tradeId: any, oldStatus: any, newStatus: any, event: any) => {
                console.log(`[TradeStatusUpdated] On-chain ID: ${tradeId}, Status: ${oldStatus} -> ${newStatus}`);

                const statusMap: Record<number, string> = {
                    0: "OFFER_ACCEPTED", 1: "TRADE_INITIATED", 2: "LOC_INITIATED",
                    3: "LOC_UPLOADED", 4: "LOC_APPROVED", 5: "FUNDS_LOCKED",
                    6: "GOODS_SHIPPED", 7: "CUSTOMS_CLEARED", 8: "DUTY_PENDING",
                    9: "DUTY_PAID", 10: "PAYMENT_AUTHORIZED", 11: "SETTLEMENT_CONFIRMED",
                    12: "COMPLETED", 13: "DISPUTED", 14: "EXPIRED"
                };

                const statusString = statusMap[Number(newStatus)] || "UNKNOWN";
                const dbTradeId = await getTradeId(Number(tradeId));
                if (!dbTradeId) return;

                try {
                    await (prisma.trade as any).update({
                        where: { id: dbTradeId },
                        data: { status: statusString },
                    });
                    console.log(`✅ Updated Trade ${tradeId} status to ${statusString}.`);
                } catch (error) {
                    console.error(`❌ Error syncing TradeStatusUpdated:`, error);
                }
            }
        );

        // 3. LoCDocumentUploaded (Contains IPFS Hash)
        blockchainService.letterOfCredit.on(
            "LoCDocumentUploaded",
            async (tradeId: any, ipfsHash: any, uploadedBy: any, event: any) => {
                console.log(`[LoCDocumentUploaded] On-chain ID: ${tradeId}, IPFS: ${ipfsHash}`);
                const dbTradeId = await getTradeId(Number(tradeId));
                if (!dbTradeId) return;

                const bank = await (prisma.user as any).findUnique({ where: { walletAddress: uploadedBy.toLowerCase() } });

                await (prisma.tradeEvent as any).create({
                    data: {
                        tradeId: dbTradeId,
                        actorId: bank?.id || null,
                        actorRole: 'IMPORTER_BANK',
                        event: 'LOC_UPLOADED',
                        ipfsHash: ipfsHash,
                        txHash: event.log.transactionHash
                    }
                });
            }
        );

        // 4. BillOfLadingIssued (Contains IPFS Hash)
        blockchainService.documentVerification.on(
            "BillOfLadingIssued",
            async (tradeId: any, ipfsHash: any, issuedBy: any, event: any) => {
                console.log(`[BillOfLadingIssued] On-chain ID: ${tradeId}, IPFS: ${ipfsHash}`);
                const dbTradeId = await getTradeId(Number(tradeId));
                if (!dbTradeId) return;

                const shipper = await (prisma.user as any).findUnique({ where: { walletAddress: issuedBy.toLowerCase() } });

                await (prisma.tradeEvent as any).create({
                    data: {
                        tradeId: dbTradeId,
                        actorId: shipper?.id || null,
                        actorRole: 'SHIPPING',
                        event: 'GOODS_SHIPPED',
                        ipfsHash: ipfsHash,
                        txHash: event.log.transactionHash
                    }
                });
            }
        );

        // 5. CustomsDecision
        blockchainService.documentVerification.on(
            "CustomsDecision",
            async (tradeId: any, cleared: any, decidedBy: any, event: any) => {
                console.log(`[CustomsDecision] On-chain ID: ${tradeId}, Cleared: ${cleared}`);
                const dbTradeId = await getTradeId(Number(tradeId));
                if (!dbTradeId) return;

                const customs = await (prisma.user as any).findUnique({ where: { walletAddress: decidedBy.toLowerCase() } });

                await (prisma.tradeEvent as any).create({
                    data: {
                        tradeId: dbTradeId,
                        actorId: customs?.id || null,
                        actorRole: 'CUSTOMS',
                        event: cleared ? 'CUSTOMS_CLEARED' : 'DUTY_PENDING',
                        txHash: event.log.transactionHash
                    }
                });
            }
        );

        // 6. PaymentSettlement Events
        blockchainService.paymentSettlement.on("PaymentAuthorized", async (tradeId: any, amount: any, authorizedBy: any, event: any) => {
            const dbTradeId = await getTradeId(Number(tradeId));
            if (!dbTradeId) return;
            await (prisma.tradeEvent as any).create({ data: { tradeId: dbTradeId, event: 'PAYMENT_AUTHORIZED', txHash: event.log.transactionHash } });
        });

        blockchainService.paymentSettlement.on("SettlementConfirmed", async (tradeId: any, confirmedBy: any, event: any) => {
            const dbTradeId = await getTradeId(Number(tradeId));
            if (!dbTradeId) return;
            await (prisma.tradeEvent as any).create({ data: { tradeId: dbTradeId, event: 'SETTLEMENT_CONFIRMED', txHash: event.log.transactionHash } });
        });

        console.log("📡 Listeners are active and watching Hardhat Node...");
    }
}
