import { Request, Response } from 'express';
import { SchedulingService, SchedulingAlgorithm } from '../services/SchedulingService';
import { logger } from '../utils/logger';

/**
 * Trigger the scheduling process for queued trades
 * POST /api/trades/schedule
 */
export const processScheduling = async (req: Request, res: Response) => {
    try {
        const { algorithm, batchSize } = req.body;
        
        if (!algorithm || !Object.values(SchedulingAlgorithm).includes(algorithm as SchedulingAlgorithm)) {
            return res.status(400).json({ 
                message: `Invalid algorithm. Supported: ${Object.values(SchedulingAlgorithm).join(', ')}` 
            });
        }

        const size = parseInt(batchSize?.toString() || '10');
        const scheduledIds = await SchedulingService.processQueue(algorithm as SchedulingAlgorithm, size);

        res.status(200).json({
            message: `Successfully scheduled ${scheduledIds.length} trades using ${algorithm}.`,
            count: scheduledIds.length,
            tradeIds: scheduledIds
        });
    } catch (error: any) {
        logger.error("Process scheduling error:", error);
        res.status(500).json({ message: error.message });
    }
};
