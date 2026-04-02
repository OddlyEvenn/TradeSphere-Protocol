import { blockchainService } from "./BlockchainService";
import { prisma } from "./PrismaService";
import { logger } from "../utils/logger";

/**
 * EventListenerService — The ONLY source of trade state DB updates.
 *
 * Architecture Rule:
 *   Frontend → Smart Contract → Blockchain Event → HERE → Database
 *
 * The database is a UI cache. Only blockchain events may change trade status.
 *
 * ─── ACTUAL CONTRACT EVENTS ───────────────────────────────────────────────
 * TradeRegistry:
 *   TradeCreated(uint256 tradeId, address importer, address exporter, uint256 amount)
 *   TradeInitiated(uint256 tradeId)
 *   TradeStatusUpdated(uint256 tradeId, uint8 oldStatus, uint8 newStatus)
 *   TradeConfirmed(uint256 tradeId, address confirmedBy)
 *
 * LetterOfCredit:
 *   LoCDocumentUploaded(uint256 tradeId, string ipfsHash, address uploadedBy)
 *   LoCApproved(uint256 tradeId, address approvedBy)
 *   FundsLocked(uint256 tradeId, uint256 amount)
 *
 * DocumentVerification:
 *   BillOfLadingIssued(uint256 tradeId, string ipfsHash, address issuedBy)
 *   CustomsDecision(uint256 tradeId, bool cleared, address decidedBy)
 *   DutyPaymentConfirmed(uint256 tradeId, address confirmedBy)
 *   TaxReceiptRecorded(uint256 tradeId, address recordedBy)
 *   GoodsReleasedFromDuty(uint256 tradeId, address releasedBy)
 *
 * PaymentSettlement:
 *   PaymentAuthorized(uint256 tradeId, uint256 amount, address authorizedBy)
 *   SettlementConfirmed(uint256 tradeId, address confirmedBy)
 *   TradeCompleted(uint256 tradeId)
 * ──────────────────────────────────────────────────────────────────────────
 */
export class EventListenerService {
    public static async startListeners() {
        logger.info("📡 [EventListenerService] Starting Blockchain Event Listeners...");

        try {
            // Helper: resolve DB trade UUID from on-chain blockchainId
            const getTradeId = async (blockchainId: number): Promise<string | null> => {
                const trade = await (prisma.trade as any).findFirst({ where: { blockchainId } });
                return trade ? trade.id : null;
            };

            // Status mapping for better readability and alignment with Smart Contracts
            const statusMap: Record<number, string> = {
                0: "OFFER_ACCEPTED",
                1: "TRADE_INITIATED",
                2: "LOC_INITIATED",
                3: "LOC_UPLOADED",
                4: "LOC_APPROVED",
                5: "FUNDS_LOCKED",
                6: "SHIPPING_ASSIGNED",
                7: "GOODS_SHIPPED",
                8: "CUSTOMS_CLEARED",
                9: "CUSTOMS_FLAGGED",
                10: "ENTRY_REJECTED",
                11: "VOTING_ACTIVE",
                12: "GOODS_RECEIVED",
                13: "PAYMENT_AUTHORIZED",
                14: "SETTLEMENT_CONFIRMED",
                15: "COMPLETED",
                16: "DISPUTED",
                17: "EXPIRED",
                18: "TRADE_REVERTED_BY_CONSENSUS",
                19: "DISPUTE_RESOLVED_NO_REVERT",
                20: "CLAIM_PAYOUT_APPROVED"
            };

            // ─────────────────────────────────────────────────────────────────────
            // 1. TradeCreated(uint256 tradeId, address importer, address exporter, uint256 amount)
            // ─────────────────────────────────────────────────────────────────────
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
                        const importer = await (prisma.user as any).findFirst({
                            where: { walletAddress: importerAddr.toLowerCase() }
                        });

                        if (!importer) {
                            logger.warn(`⚠️  No user found for importer address ${importerAddr} to sync with on-chain Trade #${tradeId}`);
                            return;
                        }

                        const trades = await (prisma.trade as any).findMany({
                            where: {
                                blockchainId: null,
                                importerId: importer.id,
                            },
                            orderBy: { createdAt: "desc" },
                            take: 1,
                        });

                        if (trades.length > 0) {
                            const tradeToSync = trades[0];

                            if (tradeToSync.blockchainId === Number(tradeId)) {
                                logger.info(`Trade ${tradeToSync.id} already synced with blockchainId ${tradeId}. Skipping.`);
                                return;
                            }

                            const staleTrade = await (prisma.trade as any).findUnique({
                                where: { blockchainId: Number(tradeId) }
                            });

                            if (staleTrade && staleTrade.id !== tradeToSync.id) {
                                logger.warn(`⚠️  Blockchain ID #${tradeId} was assigned to STALE trade ${staleTrade.id}. Un-mapping to favor new trade ${tradeToSync.id}.`);
                                await (prisma.trade as any).update({
                                    where: { id: staleTrade.id },
                                    data: { blockchainId: null }
                                });
                            }

                            await (prisma.trade as any).update({
                                where: { id: tradeToSync.id },
                                data: { blockchainId: Number(tradeId) }
                            });

                            await (prisma.tradeEvent as any).create({
                                data: {
                                    tradeId: tradeToSync.id,
                                    actorId: importer?.id || null,
                                    actorRole: "IMPORTER",
                                    event: "ON_CHAIN_TRADE_CREATED",
                                    txHash,
                                }
                            });
                            logger.success(`✅ Synced on-chain Trade #${tradeId} → DB UUID: ${tradeToSync.id}`);
                        } else {
                            logger.warn(`⚠️  No pending DB trade found for importer ${importerAddr} to sync with on-chain Trade #${tradeId}`);
                        }
                    } catch (error) {
                        logger.error(`Error syncing TradeCreated for #${tradeId}:`, error);
                    }
                }
            );

            // ─────────────────────────────────────────────────────────────────────
            // 2. TradeStatusUpdated(uint256 tradeId, uint8 oldStatus, uint8 newStatus)
            // ─────────────────────────────────────────────────────────────────────
            blockchainService.tradeRegistry.on(
                "TradeStatusUpdated",
                async (tradeId: any, oldStatus: any, newStatus: any, event: any) => {
                    const txHash = event.log.transactionHash;
                    const oldStatusNum = Number(oldStatus);
                    const newStatusNum = Number(newStatus);

                    const newStatusStr = statusMap[newStatusNum] || `UNKNOWN_${newStatusNum}`;
                    const oldStatusStr = statusMap[oldStatusNum] || `UNKNOWN_${oldStatusNum}`;

                    logger.transaction({
                        event: "TradeStatusUpdated",
                        txHash,
                        blockchainId: Number(tradeId),
                        status: `${oldStatusStr} → ${newStatusStr}` as any
                    });

                    const dbTradeId = await getTradeId(Number(tradeId));
                    if (!dbTradeId) { logger.warn(`No DB record for BC Trade #${tradeId}`); return; }

                    try {
                        await (prisma.trade as any).update({
                            where: { id: dbTradeId },
                            data: { status: newStatusStr }
                        });

                        await (prisma.tradeEvent as any).create({
                            data: {
                                tradeId: dbTradeId,
                                actorRole: "SYSTEM",
                                event: "TRADE_STATUS_UPDATED",
                                fromStatus: oldStatusStr,
                                toStatus: newStatusStr,
                                txHash
                            }
                        });
                        logger.success(`✅ Trade #${tradeId} → ${newStatusStr}`);
                    } catch (error) {
                        logger.error(`Error processing TradeStatusUpdated for #${tradeId}:`, error);
                    }
                }
            );

            // ─────────────────────────────────────────────────────────────────────
            // 3. LoCDocumentUploaded(uint256 tradeId, string ipfsHash, address uploadedBy)
            // ─────────────────────────────────────────────────────────────────────
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
                    if (!dbTradeId) { logger.warn(`No DB record for BC Trade #${tradeId}`); return; }

                    const bank = await (prisma.user as any).findFirst({ where: { walletAddress: uploadedBy.toLowerCase() } });
                    const trade = await (prisma.trade as any).findUnique({ where: { id: dbTradeId } });

                    try {
                        await (prisma.trade as any).update({
                            where: { id: dbTradeId },
                            data: { status: "LOC_UPLOADED" }
                        });

                        await (prisma.letterOfCredit as any).upsert({
                            where: { tradeId: dbTradeId },
                            update: {
                                ipfsHash: ipfsHash as string,
                                documentTxHash: txHash,
                                status: "UPLOADED",
                                uploadedAt: new Date()
                            },
                            create: {
                                tradeId: dbTradeId,
                                importerBankId: bank?.id || trade?.importerBankId,
                                amount: trade?.amount || 0,
                                expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                                ipfsHash: ipfsHash as string,
                                documentTxHash: txHash,
                                status: "UPLOADED",
                                uploadedAt: new Date()
                            }
                        });

                        await (prisma.tradeEvent as any).create({
                            data: {
                                tradeId: dbTradeId,
                                actorId: bank?.id || null,
                                actorRole: "IMPORTER_BANK",
                                event: "LOC_UPLOADED",
                                fromStatus: "LOC_INITIATED",
                                toStatus: "LOC_UPLOADED",
                                ipfsHash: ipfsHash as string,
                                txHash
                            }
                        });
                        logger.success(`✅ Trade #${tradeId} → LOC_UPLOADED. IPFS: ${ipfsHash}`);
                    } catch (error) {
                        logger.error(`Error processing LoCDocumentUploaded for #${tradeId}:`, error);
                    }
                }
            );

            // ─────────────────────────────────────────────────────────────────────
            // 4. LoCApproved(uint256 tradeId, address approvedBy)
            // ─────────────────────────────────────────────────────────────────────
            blockchainService.letterOfCredit.on(
                "LoCApproved",
                async (tradeId: any, approvedBy: any, event: any) => {
                    const txHash = event.log.transactionHash;
                    logger.transaction({ event: "LoCApproved", txHash, blockchainId: Number(tradeId) });

                    const dbTradeId = await getTradeId(Number(tradeId));
                    if (!dbTradeId) return;

                    const actor = await (prisma.user as any).findFirst({ where: { walletAddress: approvedBy.toLowerCase() } });
                    try {
                        await (prisma.trade as any).update({ where: { id: dbTradeId }, data: { status: "LOC_APPROVED" } });
                        await (prisma.letterOfCredit as any).updateMany({ where: { tradeId: dbTradeId }, data: { status: "APPROVED" } });
                        await (prisma.tradeEvent as any).create({
                            data: {
                                tradeId: dbTradeId,
                                actorId: actor?.id || null,
                                actorRole: "EXPORTER_BANK",
                                event: "LOC_APPROVED",
                                fromStatus: "LOC_UPLOADED",
                                toStatus: "LOC_APPROVED",
                                txHash
                            }
                        });
                        logger.success(`✅ Trade #${tradeId} → LOC_APPROVED`);
                    } catch (error) {
                        logger.error(`Error processing LoCApproved for #${tradeId}:`, error);
                    }
                }
            );

            // ─────────────────────────────────────────────────────────────────────
            // 5. FundsLocked(uint256 tradeId, uint256 amount)
            // ─────────────────────────────────────────────────────────────────────
            blockchainService.letterOfCredit.on(
                "FundsLocked",
                async (tradeId: any, amount: any, event: any) => {
                    const txHash = event.log.transactionHash;
                    logger.transaction({ event: "FundsLocked", txHash, blockchainId: Number(tradeId) });

                    const dbTradeId = await getTradeId(Number(tradeId));
                    if (!dbTradeId) return;

                    try {
                        await (prisma.trade as any).update({ where: { id: dbTradeId }, data: { status: "FUNDS_LOCKED" } });
                        await (prisma.tradeEvent as any).create({
                            data: {
                                tradeId: dbTradeId,
                                actorRole: "IMPORTER_BANK",
                                event: "FUNDS_LOCKED",
                                fromStatus: "LOC_APPROVED",
                                toStatus: "FUNDS_LOCKED",
                                txHash
                            }
                        });
                        logger.success(`✅ Trade #${tradeId} → FUNDS_LOCKED`);
                    } catch (error) {
                        logger.error(`Error processing FundsLocked for #${tradeId}:`, error);
                    }
                }
            );

            // ─────────────────────────────────────────────────────────────────────
            // 6. BillOfLadingIssued(uint256 tradeId, string ipfsHash, address issuedBy)
            // ─────────────────────────────────────────────────────────────────────
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
                    if (!dbTradeId) { logger.warn(`No DB record for BC Trade #${tradeId}`); return; }

                    const shipper = await (prisma.user as any).findFirst({ where: { walletAddress: issuedBy.toLowerCase() } });
                    const trade = await (prisma.trade as any).findUnique({ where: { id: dbTradeId } });

                    try {
                        await (prisma.trade as any).update({
                            where: { id: dbTradeId },
                            data: { status: "GOODS_SHIPPED" }
                        });

                        const shippingCompanyId = shipper?.id || trade?.shippingId;
                        if (!shippingCompanyId) {
                            logger.warn(`⚠️ Cannot create BillOfLading for trade ${dbTradeId}: No shipping context found (user or trade).`);
                            return;
                        }

                        await (prisma.billOfLading as any).upsert({
                            where: { tradeId: dbTradeId },
                            update: {
                                ipfsHash: ipfsHash as string,
                                documentTxHash: txHash,
                                issuedAt: new Date()
                            },
                            create: {
                                tradeId: dbTradeId,
                                shippingCompanyId,
                                bolNumber: `BOL-${dbTradeId.substring(0, 8).toUpperCase()}`,
                                portOfLoading: "Origin",
                                portOfDischarge: trade?.destination || "Destination",
                                ipfsHash: ipfsHash as string,
                                documentTxHash: txHash,
                                issuedAt: new Date()
                            }
                        });

                        await (prisma.tradeEvent as any).create({
                            data: {
                                tradeId: dbTradeId,
                                actorId: shipper?.id || null,
                                actorRole: "SHIPPING",
                                event: "GOODS_SHIPPED",
                                fromStatus: "FUNDS_LOCKED",
                                toStatus: "GOODS_SHIPPED",
                                ipfsHash: ipfsHash as string,
                                txHash
                            }
                        });
                        logger.success(`✅ Trade #${tradeId} → GOODS_SHIPPED. BoL IPFS: ${ipfsHash}`);
                    } catch (error) {
                        logger.error(`Error processing BillOfLadingIssued for #${tradeId}:`, error);
                    }
                }
            );

            // ─────────────────────────────────────────────────────────────────────
            // 7. CustomsDecisionMade(uint256 tradeId, uint8 decision, uint256 taxAmount, address decidedBy)
            // ─────────────────────────────────────────────────────────────────────
            blockchainService.documentVerification.on(
                "CustomsDecisionMade",
                async (tradeId: any, decision: any, taxAmount: any, decidedBy: any, event: any) => {
                    const txHash = event.log.transactionHash;
                    const decisionNum = Number(decision);
                    // 0 = clear, 1 = flags, 2 = reject
                    let newStatus = "CUSTOMS_CLEARED";
                    if (decisionNum === 1) newStatus = "CUSTOMS_FLAGGED";
                    if (decisionNum === 2) newStatus = "ENTRY_REJECTED";

                    logger.transaction({
                        event: "CustomsDecisionMade",
                        txHash,
                        blockchainId: Number(tradeId),
                        status: newStatus as any,
                        actor: `Customs: ${decidedBy}`
                    });

                    const dbTradeId = await getTradeId(Number(tradeId));
                    if (!dbTradeId) return;

                    const customs = await (prisma.user as any).findFirst({ where: { walletAddress: decidedBy.toLowerCase() } });
                    try {
                        await (prisma.trade as any).update({ where: { id: dbTradeId }, data: { status: newStatus } });
                        
                        // Update or create CustomsVerification record
                        await (prisma.customsVerification as any).upsert({
                            where: { tradeId: dbTradeId },
                            update: {
                                decision: decisionNum,
                                taxAmount: decisionNum === 1 ? Number(taxAmount) : 0,
                                verifiedAt: new Date()
                            },
                            create: {
                                tradeId: dbTradeId,
                                customsOfficerId: customs?.id || '',
                                decision: decisionNum,
                                taxAmount: decisionNum === 1 ? Number(taxAmount) : 0,
                                verifiedAt: new Date()
                            }
                        });


                        await (prisma.tradeEvent as any).create({
                            data: {
                                tradeId: dbTradeId,
                                actorId: customs?.id || null,
                                actorRole: "CUSTOMS",
                                event: newStatus,
                                fromStatus: "GOODS_SHIPPED",
                                toStatus: newStatus,
                                txHash
                            }
                        });
                        logger.success(`✅ Trade #${tradeId} → CustomsDecisionMade: ${newStatus}`);
                    } catch (error) {
                        logger.error(`Error processing CustomsDecisionMade for #${tradeId}:`, error);
                    }
                }
            );

            // ─────────────────────────────────────────────────────────────────────
            // 8. TaxPaidAndGoodsReleased(uint256 tradeId, uint256 taxAmount, address releasedBy)
            // ─────────────────────────────────────────────────────────────────────
            blockchainService.documentVerification.on(
                "TaxPaidAndGoodsReleased",
                async (tradeId: any, taxAmount: any, releasedBy: any, event: any) => {
                    const txHash = event.log.transactionHash;
                    logger.transaction({ event: "TaxPaidAndGoodsReleased", txHash, blockchainId: Number(tradeId) });

                    const dbTradeId = await getTradeId(Number(tradeId));
                    if (!dbTradeId) return;

                    const actor = await (prisma.user as any).findFirst({ where: { walletAddress: releasedBy.toLowerCase() } });
                    try {
                        await (prisma.trade as any).update({ where: { id: dbTradeId }, data: { status: "CUSTOMS_CLEARED" } });
                        await (prisma.customsVerification as any).updateMany({
                            where: { tradeId: dbTradeId },
                            data: { taxPaid: true }
                        });
                        await (prisma.tradeEvent as any).create({
                            data: {
                                tradeId: dbTradeId,
                                actorId: actor?.id || null,
                                actorRole: "EXPORTER",  // EXPORTER PAYS THE TAX
                                event: "TAX_PAID_AND_GOODS_RELEASED",
                                fromStatus: "CUSTOMS_FLAGGED",
                                toStatus: "CUSTOMS_CLEARED",
                                txHash
                            }
                        });
                        logger.success(`✅ Trade #${tradeId} → CUSTOMS_CLEARED (Tax Paid)`);
                    } catch (error) {
                        logger.error(`Error processing TaxPaidAndGoodsReleased for #${tradeId}:`, error);
                    }
                }
            );

            // ─────────────────────────────────────────────────────────────────────
            // 10. PaymentAuthorized(uint256 tradeId, uint256 amount, address authorizedBy)
            // ─────────────────────────────────────────────────────────────────────
            blockchainService.paymentSettlement.on(
                "PaymentAuthorized",
                async (tradeId: any, amount: any, authorizedBy: any, event: any) => {
                    const txHash = event.log.transactionHash;
                    logger.transaction({ event: "PaymentAuthorized", txHash, blockchainId: Number(tradeId) });

                    const dbTradeId = await getTradeId(Number(tradeId));
                    if (!dbTradeId) return;

                    const actor = await (prisma.user as any).findFirst({ where: { walletAddress: authorizedBy.toLowerCase() } });
                    try {
                        await (prisma.trade as any).update({ where: { id: dbTradeId }, data: { status: "PAYMENT_AUTHORIZED" } });
                        await (prisma.tradeEvent as any).create({
                            data: {
                                tradeId: dbTradeId,
                                actorId: actor?.id || null,
                                actorRole: "IMPORTER_BANK",
                                event: "PAYMENT_AUTHORIZED",
                                fromStatus: "CUSTOMS_CLEARED",
                                toStatus: "PAYMENT_AUTHORIZED",
                                txHash
                            }
                        });
                        logger.success(`✅ Trade #${tradeId} → PAYMENT_AUTHORIZED`);
                    } catch (error) {
                        logger.error(`Error logging PaymentAuthorized for #${tradeId}:`, error);
                    }
                }
            );

            // ─────────────────────────────────────────────────────────────────────
            // 11. SettlementConfirmed(uint256 tradeId, address confirmedBy)
            // ─────────────────────────────────────────────────────────────────────
            blockchainService.paymentSettlement.on(
                "SettlementConfirmed",
                async (tradeId: any, confirmedBy: any, event: any) => {
                    const txHash = event.log.transactionHash;
                    logger.transaction({ event: "SettlementConfirmed", txHash, blockchainId: Number(tradeId) });

                    const dbTradeId = await getTradeId(Number(tradeId));
                    if (!dbTradeId) return;

                    const actor = await (prisma.user as any).findFirst({ where: { walletAddress: confirmedBy.toLowerCase() } });
                    try {
                        await (prisma.trade as any).update({ where: { id: dbTradeId }, data: { status: "COMPLETED" } });
                        await (prisma.tradeEvent as any).create({
                            data: {
                                tradeId: dbTradeId,
                                actorId: actor?.id || null,
                                actorRole: "EXPORTER_BANK",
                                event: "SETTLEMENT_CONFIRMED",
                                fromStatus: "PAYMENT_AUTHORIZED",
                                toStatus: "COMPLETED",
                                txHash
                            }
                        });
                        logger.success(`✅ Trade #${tradeId} → COMPLETED 🎉`);
                    } catch (error) {
                        logger.error(`Error logging SettlementConfirmed for #${tradeId}:`, error);
                    }
                }
            );

            // ─────────────────────────────────────────────────────────────────────
            // 11b. FundsRefunded(uint256 tradeId, address to, uint256 amount)
            // ─────────────────────────────────────────────────────────────────────
            blockchainService.paymentSettlement.on(
                "FundsRefunded",
                async (tradeId: any, to: any, amount: any, event: any) => {
                    const txHash = event.log.transactionHash;
                    logger.transaction({ event: "FundsRefunded", txHash, blockchainId: Number(tradeId), actor: `To: ${to}` });

                    const dbTradeId = await getTradeId(Number(tradeId));
                    if (!dbTradeId) return;

                    try {
                        const actor = await (prisma.user as any).findFirst({ where: { walletAddress: to.toLowerCase() } });
                        await (prisma.trade as any).update({
                            where: { id: dbTradeId },
                            data: { status: "TRADE_REVERTED_BY_CONSENSUS" }
                        });

                        await (prisma.tradeEvent as any).create({
                            data: {
                                tradeId: dbTradeId,
                                actorId: actor?.id || null,
                                actorRole: "SYSTEM",
                                event: "FUNDS_REFUNDED",
                                toStatus: "TRADE_REVERTED_BY_CONSENSUS",
                                metadata: { refundAmount: Number(amount) },
                                txHash
                            }
                        });
                        logger.success(`✅ Trade #${tradeId} Funds Refunded to Importer`);
                    } catch (error) {
                        logger.error(`Error logging FundsRefunded for #${tradeId}:`, error);
                    }
                }
            );

            // ─────────────────────────────────────────────────────────────────────
            // 11c. InsurancePayout(uint256 tradeId, address to, uint256 amount)
            // ─────────────────────────────────────────────────────────────────────
            blockchainService.paymentSettlement.on(
                "InsurancePayout",
                async (tradeId: any, to: any, amount: any, event: any) => {
                    const txHash = event.log.transactionHash;
                    logger.transaction({ event: "InsurancePayout", txHash, blockchainId: Number(tradeId), actor: `To: ${to}` });

                    const dbTradeId = await getTradeId(Number(tradeId));
                    if (!dbTradeId) return;

                    try {
                        const actor = await (prisma.user as any).findFirst({ where: { walletAddress: to.toLowerCase() } });
                        await (prisma.tradeEvent as any).create({
                            data: {
                                tradeId: dbTradeId,
                                actorId: actor?.id || null,
                                actorRole: "SYSTEM",
                                event: "INSURANCE_PAYOUT_INITIATED",
                                metadata: { payoutAmount: Number(amount) },
                                txHash
                            }
                        });
                        logger.success(`✅ Trade #${tradeId} Insurance Payout Triggered`);
                    } catch (error) {
                        logger.error(`Error logging InsurancePayout for #${tradeId}:`, error);
                    }
                }
            );

            // ─────────────────────────────────────────────────────────────────────
            // 13. AdvisingBankAssigned(uint256 tradeId, address advisingBank)
            // ─────────────────────────────────────────────────────────────────────
            blockchainService.tradeRegistry.on(
                "AdvisingBankAssigned",
                async (tradeId: any, bankAddr: any, event: any) => {
                    const txHash = event.log.transactionHash;
                    logger.transaction({ event: "AdvisingBankAssigned", txHash, blockchainId: Number(tradeId), actor: `Bank: ${bankAddr}` });
                    const dbTradeId = await getTradeId(Number(tradeId));
                    if (!dbTradeId) return;

                    const bank = await (prisma.user as any).findFirst({ where: { walletAddress: bankAddr.toLowerCase() } });
                    await (prisma.trade as any).update({
                        where: { id: dbTradeId },
                        data: { exporterBankId: bank?.id || null }
                    });
                    logger.success(`✅ Trade #${tradeId} advising bank synced: ${bankAddr}`);
                }
            );

            // ─────────────────────────────────────────────────────────────────────
            // 12. TradeCompleted(uint256 tradeId)
            // ─────────────────────────────────────────────────────────────────────
            blockchainService.paymentSettlement.on(
                "TradeCompleted",
                async (tradeIdArg: any, event: any) => {
                    const txHash = event.log.transactionHash;
                    logger.transaction({ event: "TradeCompleted", txHash, blockchainId: Number(tradeIdArg) });

                    const dbTradeId = await getTradeId(Number(tradeIdArg));
                    if (!dbTradeId) return;

                    try {
                        await (prisma.trade as any).update({ where: { id: dbTradeId }, data: { status: "COMPLETED" } });
                        logger.success(`✅ Trade #${tradeIdArg} → COMPLETED (TradeCompleted event)`);
                    } catch (error) {
                        logger.error(`Error logging TradeCompleted for #${tradeIdArg}:`, error);
                    }
                }
            );

            // ─────────────────────────────────────────────────────────────────────
            // 14. ShippingCompanyAssigned(uint256 tradeId, address shippingCompany)
            // ─────────────────────────────────────────────────────────────────────
            blockchainService.tradeRegistry.on(
                "ShippingCompanyAssigned",
                async (tradeId: any, carrierAddr: any, event: any) => {
                    const txHash = event.log.transactionHash;
                    logger.transaction({ event: "ShippingCompanyAssigned", txHash, blockchainId: Number(tradeId), actor: `Shipping: ${carrierAddr}` });
                    const dbTradeId = await getTradeId(Number(tradeId));
                    if (!dbTradeId) return;

                    const carrier = await (prisma.user as any).findFirst({ where: { walletAddress: carrierAddr.toLowerCase() } });
                    await (prisma.trade as any).update({
                        where: { id: dbTradeId },
                        data: { shippingId: carrier?.id || null }
                    });
                    logger.success(`✅ Trade #${tradeId} shipping company synced: ${carrierAddr}`);
                }
            );

            // ─────────────────────────────────────────────────────────────────────
            // 14b. VotingDeadlineSet(uint256 tradeId, uint256 deadline)
            // ─────────────────────────────────────────────────────────────────────
            blockchainService.tradeRegistry.on(
                "VotingDeadlineSet",
                async (tradeId: any, deadline: any, event: any) => {
                    const txHash = event.log.transactionHash;
                    const dbTradeId = await getTradeId(Number(tradeId));
                    if (!dbTradeId) return;

                    const deadlineDate = new Date(Number(deadline) * 1000);
                    logger.transaction({ event: "VotingDeadlineSet", txHash, blockchainId: Number(tradeId), status: deadlineDate.toISOString() as any });

                    await (prisma.trade as any).update({
                        where: { id: dbTradeId },
                        data: { votingDeadline: deadlineDate }
                    });
                    logger.success(`✅ Trade #${tradeId} Voting Deadline set to: ${deadlineDate.toISOString()}`);
                }
            );

            // ─────────────────────────────────────────────────────────────────────
            // 15. DisputeActivated(uint256 tradeId, uint256 votingDeadline, address activatedBy)
            // ─────────────────────────────────────────────────────────────────────
            if (blockchainService.consensusDispute) {
                blockchainService.consensusDispute.on(
                    "DisputeActivated",
                    async (tradeId: any, votingDeadline: any, activatedBy: any, event: any) => {
                        const txHash = event.log.transactionHash;
                        logger.transaction({ event: "DisputeActivated", txHash, blockchainId: Number(tradeId), actor: `System: ${activatedBy}` });
                        
                        const dbTradeId = await getTradeId(Number(tradeId));
                        if (!dbTradeId) return;

                        const user = await (prisma.user as any).findFirst({ where: { walletAddress: activatedBy.toLowerCase() } });
                        
                        // Update trade with voting deadline and status
                        const deadlineDate = new Date(Number(votingDeadline) * 1000);
                        await (prisma.trade as any).update({ 
                            where: { id: dbTradeId }, 
                            data: { 
                                status: "VOTING_ACTIVE",
                                votingDeadline: deadlineDate 
                            } 
                        });

                        await (prisma.tradeEvent as any).create({
                            data: {
                                tradeId: dbTradeId,
                                actorId: user?.id || null,
                                actorRole: user?.role || "SYSTEM",
                                event: "DISPUTE_ACTIVATED",
                                metadata: { deadline: deadlineDate.toISOString() },
                                txHash
                            }
                        });
                        logger.success(`✅ Trade #${tradeId} Dispute Activated. Deadline: ${deadlineDate.toISOString()}`);
                    }
                );

                // ─────────────────────────────────────────────────────────────────────
                // 16. VoteCast(uint256 tradeId, address voter, uint8 vote)
                // ─────────────────────────────────────────────────────────────────────
                blockchainService.consensusDispute.on(
                    "VoteCast",
                    async (tradeId: any, voter: any, vote: any, event: any) => {
                        const txHash = event.log.transactionHash;
                        let voteStr = "NONE";
                        if (Number(vote) === 1) voteStr = "REVERT";
                        else if (Number(vote) === 2) voteStr = "NO_REVERT";

                        logger.transaction({ event: "VoteCast", txHash, blockchainId: Number(tradeId), actor: `Voter: ${voter}`, status: `Voted ${voteStr}` as any });

                        const dbTradeId = await getTradeId(Number(tradeId));
                        if (!dbTradeId) return;

                        const user = await (prisma.user as any).findFirst({ where: { walletAddress: voter.toLowerCase() } });
                        await (prisma.tradeEvent as any).create({
                            data: {
                                tradeId: dbTradeId,
                                actorId: user?.id || null,
                                actorRole: user?.role || "SYSTEM",
                                event: `VOTE_CAST_${voteStr}`,
                                txHash
                            }
                        });
                    }
                );

                // ─────────────────────────────────────────────────────────────────────
                // 17. InspectorDecisionSubmitted(uint256 tradeId, bool decision, uint8 cargoStatus)
                // ─────────────────────────────────────────────────────────────────────
                blockchainService.consensusDispute.on(
                    "InspectorDecisionSubmitted",
                    async (tradeId: any, decision: any, cargoStatus: any, event: any) => {
                        const txHash = event.log.transactionHash;
                        let statusStr = "SAFE";
                        if (Number(cargoStatus) === 1) statusStr = "DAMAGED";
                        else if (Number(cargoStatus) === 2) statusStr = "FAKE_DOCUMENTS";

                        logger.transaction({ event: "InspectorDecisionSubmitted", txHash, blockchainId: Number(tradeId), status: `Cargo: ${statusStr}` as any });

                        const dbTradeId = await getTradeId(Number(tradeId));
                        if (!dbTradeId) return;

                        await (prisma.tradeEvent as any).create({
                            data: {
                                tradeId: dbTradeId,
                                actorRole: "INSPECTOR",
                                event: "INSPECTOR_DECISION",
                                metadata: { cargoStatus: statusStr, decision: decision },
                                txHash
                            }
                        });
                        logger.success(`✅ Trade #${tradeId} Inspector Decision: Cargo ${statusStr}`);
                    }
                );

                // ─────────────────────────────────────────────────────────────────────
                // 18. VotingFinalized(uint256 tradeId, uint8 revertVotes, uint8 noRevertVotes, uint8 outcome)
                // ─────────────────────────────────────────────────────────────────────
                blockchainService.consensusDispute.on(
                    "VotingFinalized",
                    async (tradeId: any, revertVotes: any, noRevertVotes: any, outcome: any, event: any) => {
                        const txHash = event.log.transactionHash;
                        const statusStr = statusMap[Number(outcome)] || "UNKNOWN";
                        logger.transaction({ event: "VotingFinalized", txHash, blockchainId: Number(tradeId), status: statusStr as any });

                        const dbTradeId = await getTradeId(Number(tradeId));
                        if (!dbTradeId) return;

                        await (prisma.trade as any).update({ where: { id: dbTradeId }, data: { status: statusStr } });

                        await (prisma.tradeEvent as any).create({
                            data: {
                                tradeId: dbTradeId,
                                actorRole: "SYSTEM",
                                event: "VOTING_FINALIZED",
                                toStatus: statusStr,
                                metadata: { revertVotes: Number(revertVotes), noRevertVotes: Number(noRevertVotes) },
                                txHash
                            }
                        });
                        logger.success(`✅ Trade #${tradeId} Voting Finalized: ${statusStr}`);
                    }
                );
            }

            logger.info("📡 All blockchain event listeners active. DB is now a pure event-driven cache.");

            // ── Robustness: Handle Provider Errors (e.g., 'filter not found') ──
            // Using a persistent error handler on the provider to catch polling failures
            const errorHandler = (error: any) => {
                const message = error?.message || error?.error?.message || "";
                if (
                    message.includes("filter not found") || 
                    message.includes("could not coalesce error") ||
                    message.includes("ECONNRESET") ||
                    message.includes("NETWORK_ERROR")
                ) {
                    logger.warn("⚠️  Blockchain connection issue or filter error detected. Re-starting listeners in 5s...");

                    // Prevent infinite recursion by removing the error handler before restarting
                    blockchainService.provider.off("error", errorHandler);

                    // Clean up all contract-level listeners
                    blockchainService.tradeRegistry.removeAllListeners();
                    blockchainService.letterOfCredit.removeAllListeners();
                    blockchainService.documentVerification.removeAllListeners();
                    blockchainService.paymentSettlement.removeAllListeners();

                    setTimeout(() => EventListenerService.startListeners(), 5000);
                } else {
                    logger.error("❌ [EventListenerService] Unhandled Provider Error:", error);
                }
            };

            blockchainService.provider.on("error", errorHandler);

        } catch (fatalError) {
            logger.error("🚨 [EventListenerService] FATAL ERROR during listener initialization:", fatalError);
            logger.info("🔄 Retrying listener startup in 10 seconds...");
            setTimeout(() => EventListenerService.startListeners(), 10000);
        }
    }
}
