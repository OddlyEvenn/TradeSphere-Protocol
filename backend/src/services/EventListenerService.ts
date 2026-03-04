import { blockchainService } from "./BlockchainService";
import { prisma } from "./PrismaService";

export class EventListenerService {
    public static async startListeners() {
        console.log("📡 [EventListenerService] Starting Blockchain Listeners...");

        // 1. Listen for TradeCreated
        blockchainService.tradeRegistry.on(
            "TradeCreated",
            async (tradeId, importerAddr, exporterAddr, amount, event) => {
                console.log(`[TradeCreated] ID: ${tradeId}, Importer: ${importerAddr}, Exporter: ${exporterAddr}`);

                try {
                    // Find the importer and exporter by their wallet addresses
                    const importer = await (prisma.user as any).findUnique({ where: { walletAddress: importerAddr.toLowerCase() } });
                    const exporter = await (prisma.user as any).findUnique({ where: { walletAddress: exporterAddr.toLowerCase() } });

                    if (!importer || !exporter) {
                        console.warn(`⚠️ Users not found for addresses in DB: Importer(${importerAddr}), Exporter(${exporterAddr})`);
                    }

                    // Link the blockchain ID to the database record
                    // We match by amount and importerId for trades created via the API
                    await (prisma.trade as any).updateMany({
                        where: {
                            blockchainId: null,
                            amount: parseFloat(blockchainService.formatEther(amount)),
                            importerId: importer?.id,
                        },
                        data: {
                            blockchainId: Number(tradeId),
                            status: "CREATED",
                            exporterId: exporter?.id || "unknown",
                        },
                    });
                    console.log(`✅ Synced Trade ${tradeId} to Database.`);
                } catch (error) {
                    console.error(`❌ Error syncing TradeCreated:`, error);
                }
            }
        );

        // 2. Listen for TradeStatusUpdated
        blockchainService.tradeRegistry.on(
            "TradeStatusUpdated",
            async (tradeId, newStatus, event) => {
                console.log(`[TradeStatusUpdated] ID: ${tradeId}, Status: ${newStatus}`);

                const statusMap: Record<number, string> = {
                    0: "CREATED",
                    1: "LOC_REQUESTED",
                    2: "LOC_ISSUED",
                    3: "DOCS_SUBMITTED",
                    4: "DOCS_VERIFIED",
                    5: "GOODS_RECEIVED",
                    6: "PAYMENT_AUTHORIZED"
                };

                try {
                    await (prisma.trade as any).update({
                        where: { blockchainId: Number(tradeId) },
                        data: { status: statusMap[Number(newStatus)] || "UNKNOWN" },
                    });
                    console.log(`✅ Updated Trade ${tradeId} status to ${statusMap[Number(newStatus)]}.`);
                } catch (error) {
                    console.error(`❌ Error syncing TradeStatusUpdated:`, error);
                }
            }
        );

        // 3. Listen for DocumentsSubmitted (from DocumentVerification contract)
        blockchainService.documentVerification.on(
            "DocumentsSubmitted",
            async (tradeId, ipfsHash, event) => {
                console.log(`[DocumentsSubmitted] ID: ${tradeId}, IPFS: ${ipfsHash}`);
                // We could store the IPFS hash in a separate 'Documents' model or update the Trade record
                // For now, we just log it and the status update will handle the rest.
            }
        );

        console.log("📡 Listeners are active and watching Sepolia...");
    }
}
