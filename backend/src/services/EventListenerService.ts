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

        // Helper: resolve DB trade UUID from on-chain blockchainId
        const getTradeId = async (blockchainId: number): Promise<string | null> => {
            const trade = await (prisma.trade as any).findFirst({ where: { blockchainId } });
            return trade ? trade.id : null;
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

                        // Guard: Check if this trade already has the blockchainId (idempotency)
                        if (tradeToSync.blockchainId === Number(tradeId)) {
                            logger.info(`Trade ${tradeToSync.id} already synced with blockchainId ${tradeId}. Skipping.`);
                            return;
                        }

                        // ─── STALE ID CLEANUP ──────────────────────────────────────────
                        // If ANY other trade already has this blockchainId, it's stale 
                        // (likely from a previous contract deployment). We must un-map it 
                        // to prevent P2002 Unique Constraint violation.
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
                        // ──────────────────────────────────────────────────────────────

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
        //    This is the generic status change event from TradeRegistry.
        //    We use it to handle LOC_INITIATED and other status transitions
        //    that go through the TradeRegistry contract.
        // ─────────────────────────────────────────────────────────────────────
        blockchainService.tradeRegistry.on(
            "TradeStatusUpdated",
            async (tradeId: any, oldStatus: any, newStatus: any, event: any) => {
                const txHash = event.log.transactionHash;
                const oldStatusNum = Number(oldStatus);
                const newStatusNum = Number(newStatus);

                // Map contract status enum to our string statuses
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
                    9: "DUTY_PENDING",
                    10: "DUTY_PAID",
                    11: "PAYMENT_AUTHORIZED",
                    12: "SETTLEMENT_CONFIRMED",
                    13: "COMPLETED",
                };

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
        //    NOTE: Only 2 params — no lockedBy address
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

                    await (prisma.billOfLading as any).upsert({
                        where: { tradeId: dbTradeId },
                        update: {
                            ipfsHash: ipfsHash as string,
                            documentTxHash: txHash,
                            issuedAt: new Date()
                        },
                        create: {
                            tradeId: dbTradeId,
                            shippingCompanyId: shipper?.id || trade?.shippingId,
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
        // 7. CustomsDecision(uint256 tradeId, bool cleared, address decidedBy)
        // ─────────────────────────────────────────────────────────────────────
        blockchainService.documentVerification.on(
            "CustomsDecision",
            async (tradeId: any, cleared: any, decidedBy: any, event: any) => {
                const txHash = event.log.transactionHash;
                const newStatus = cleared ? "CUSTOMS_CLEARED" : "DUTY_PENDING";
                logger.transaction({
                    event: "CustomsDecision",
                    txHash,
                    blockchainId: Number(tradeId),
                    status: newStatus,
                    actor: `Customs: ${decidedBy}`
                });

                const dbTradeId = await getTradeId(Number(tradeId));
                if (!dbTradeId) return;

                const customs = await (prisma.user as any).findFirst({ where: { walletAddress: decidedBy.toLowerCase() } });
                try {
                    await (prisma.trade as any).update({ where: { id: dbTradeId }, data: { status: newStatus } });
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
                    logger.success(`✅ Trade #${tradeId} → ${newStatus}`);
                } catch (error) {
                    logger.error(`Error processing CustomsDecision for #${tradeId}:`, error);
                }
            }
        );

        // ─────────────────────────────────────────────────────────────────────
        // 8. DutyPaymentConfirmed(uint256 tradeId, address confirmedBy)
        //    Importer Bank confirms the duty fee has been paid off-chain.
        // ─────────────────────────────────────────────────────────────────────
        blockchainService.documentVerification.on(
            "DutyPaymentConfirmed",
            async (tradeId: any, confirmedBy: any, event: any) => {
                const txHash = event.log.transactionHash;
                logger.transaction({ event: "DutyPaymentConfirmed", txHash, blockchainId: Number(tradeId) });

                const dbTradeId = await getTradeId(Number(tradeId));
                if (!dbTradeId) return;

                const actor = await (prisma.user as any).findFirst({ where: { walletAddress: confirmedBy.toLowerCase() } });
                try {
                    await (prisma.trade as any).update({ where: { id: dbTradeId }, data: { status: "DUTY_PAID" } });
                    await (prisma.tradeEvent as any).create({
                        data: {
                            tradeId: dbTradeId,
                            actorId: actor?.id || null,
                            actorRole: "IMPORTER_BANK",
                            event: "DUTY_PAYMENT_CONFIRMED",
                            fromStatus: "DUTY_PENDING",
                            toStatus: "DUTY_PAID",
                            txHash
                        }
                    });
                    logger.success(`✅ Trade #${tradeId} → DUTY_PAID (confirmed by Importer Bank)`);
                } catch (error) {
                    logger.error(`Error processing DutyPaymentConfirmed for #${tradeId}:`, error);
                }
            }
        );

        // ─────────────────────────────────────────────────────────────────────
        // 8b. TaxReceiptRecorded(uint256 tradeId, address recordedBy)
        //     Tax Authority records the receipt after Importer Bank confirmed.
        // ─────────────────────────────────────────────────────────────────────
        blockchainService.documentVerification.on(
            "TaxReceiptRecorded",
            async (tradeId: any, recordedBy: any, event: any) => {
                const txHash = event.log.transactionHash;
                logger.transaction({ event: "TaxReceiptRecorded", txHash, blockchainId: Number(tradeId) });

                const dbTradeId = await getTradeId(Number(tradeId));
                if (!dbTradeId) return;

                const actor = await (prisma.user as any).findFirst({ where: { walletAddress: recordedBy.toLowerCase() } });
                try {
                    await (prisma.tradeEvent as any).create({
                        data: {
                            tradeId: dbTradeId,
                            actorId: actor?.id || null,
                            actorRole: "TAX_AUTHORITY",
                            event: "TAX_RECEIPT_RECORDED",
                            fromStatus: "DUTY_PAID",
                            toStatus: "DUTY_PAID",
                            txHash
                        }
                    });
                    logger.success(`✅ Trade #${tradeId} → Tax receipt recorded by Tax Authority`);
                } catch (error) {
                    logger.error(`Error processing TaxReceiptRecorded for #${tradeId}:`, error);
                }
            }
        );

        // ─────────────────────────────────────────────────────────────────────
        // 9. GoodsReleasedFromDuty(uint256 tradeId, address releasedBy)
        // ─────────────────────────────────────────────────────────────────────
        blockchainService.documentVerification.on(
            "GoodsReleasedFromDuty",
            async (tradeId: any, releasedBy: any, event: any) => {
                const txHash = event.log.transactionHash;
                logger.transaction({ event: "GoodsReleasedFromDuty", txHash, blockchainId: Number(tradeId) });

                const dbTradeId = await getTradeId(Number(tradeId));
                if (!dbTradeId) return;

                const actor = await (prisma.user as any).findFirst({ where: { walletAddress: releasedBy.toLowerCase() } });
                try {
                    await (prisma.trade as any).update({ where: { id: dbTradeId }, data: { status: "CUSTOMS_CLEARED" } });
                    await (prisma.tradeEvent as any).create({
                        data: {
                            tradeId: dbTradeId,
                            actorId: actor?.id || null,
                            actorRole: "TAX_AUTHORITY",
                            event: "GOODS_RELEASED_FROM_DUTY",
                            fromStatus: "DUTY_PAID",
                            toStatus: "CUSTOMS_CLEARED",
                            txHash
                        }
                    });
                    logger.success(`✅ Trade #${tradeId} → CUSTOMS_CLEARED (from duty release)`);
                } catch (error) {
                    logger.error(`Error processing GoodsReleasedFromDuty for #${tradeId}:`, error);
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
        // 12. TradeCompleted(uint256 tradeId) — PaymentSettlement final event
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

        logger.info("📡 All blockchain event listeners active. DB is now a pure event-driven cache.");
    }
}
