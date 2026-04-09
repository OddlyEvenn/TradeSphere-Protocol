import { prisma } from './PrismaService';
import { logger } from '../utils/logger';

export enum SchedulingAlgorithm {
    FCFS = 'FCFS',
    PRIORITY = 'PRIORITY',
    ROUND_ROBIN = 'ROUND_ROBIN'
}

export class SchedulingService {
    /**
     * Process queued trades based on the selected algorithm
     */
    public static async processQueue(algorithm: SchedulingAlgorithm, batchSize: number = 5): Promise<string[]> {
        logger.info(`🚀 Starting scheduling process using ${algorithm} (Batch Size: ${batchSize})`);
        
        let tradesToProcess: any[] = [];

        switch (algorithm) {
            case SchedulingAlgorithm.FCFS:
                tradesToProcess = await this.getFCFSTrades(batchSize);
                break;
            case SchedulingAlgorithm.PRIORITY:
                tradesToProcess = await this.getPriorityTrades(batchSize);
                break;
            case SchedulingAlgorithm.ROUND_ROBIN:
                tradesToProcess = await this.getRoundRobinTrades(batchSize);
                break;
            default:
                throw new Error(`Unsupported scheduling algorithm: ${algorithm}`);
        }

        if (tradesToProcess.length === 0) {
            logger.info("ℹ️ No queued trades found to process.");
            return [];
        }

        const tradeIds = tradesToProcess.map(t => t.id);
        
        // Update trades to OPEN_FOR_OFFERS
        await (prisma.trade as any).updateMany({
            where: { id: { in: tradeIds } },
            data: { status: 'OPEN_FOR_OFFERS' }
        });

        // Record events for each processed trade
        for (const trade of tradesToProcess) {
            await (prisma.tradeEvent as any).create({
                data: {
                    tradeId: trade.id,
                    actorRole: 'SYSTEM',
                    event: 'TRADE_SCHEDULED',
                    fromStatus: 'QUEUED',
                    toStatus: 'OPEN_FOR_OFFERS',
                    metadata: { algorithm, batchSize }
                }
            });
        }

        logger.success(`✅ Successfully scheduled ${tradeIds.length} trades.`);
        return tradeIds;
    }

    /**
     * FCFS: Sort by createdAt ASC
     */
    private static async getFCFSTrades(batchSize: number) {
        return await (prisma.trade as any).findMany({
            where: { status: 'QUEUED' },
            orderBy: { createdAt: 'asc' },
            take: batchSize
        });
    }

    /**
     * Priority: Sort by priority DESC, then createdAt ASC
     */
    private static async getPriorityTrades(batchSize: number) {
        return await (prisma.trade as any).findMany({
            where: { status: 'QUEUED' },
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'asc' }
            ],
            take: batchSize
        });
    }

    /**
     * Round Robin: Balance across importers
     */
    private static async getRoundRobinTrades(batchSize: number) {
        // Fetch all queued trades
        const allQueued = await (prisma.trade as any).findMany({
            where: { status: 'QUEUED' },
            orderBy: { createdAt: 'asc' }
        });

        if (allQueued.length === 0) return [];

        // Group by importerId
        const groups: Map<string, any[]> = new Map();
        for (const trade of allQueued) {
            if (!groups.has(trade.importerId)) {
                groups.set(trade.importerId, []);
            }
            groups.get(trade.importerId)!.push(trade);
        }

        const selectedTrades: any[] = [];
        const importerIds = Array.from(groups.keys());
        let currentImporterIdx = 0;

        // Round robin selection
        while (selectedTrades.length < batchSize && importerIds.length > 0) {
            const importerId = importerIds[currentImporterIdx];
            const importerTrades = groups.get(importerId)!;

            if (importerTrades.length > 0) {
                selectedTrades.push(importerTrades.shift());
                currentImporterIdx = (currentImporterIdx + 1) % importerIds.length;
            } else {
                // No more trades for this importer, remove from rotation
                importerIds.splice(currentImporterIdx, 1);
                if (importerIds.length > 0) {
                    currentImporterIdx %= importerIds.length;
                }
            }
        }

        return selectedTrades;
    }
}
