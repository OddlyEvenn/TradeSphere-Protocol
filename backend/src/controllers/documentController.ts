import { Request, Response } from 'express';
import { ipfsService } from '../services/IpfsService';
import { prisma } from '../services/PrismaService';

export const uploadDocument = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Ensure valid pinata interaction
        const ipfsHash = await ipfsService.uploadFile(req.file.buffer, req.file.originalname);

        res.status(200).json({
            ipfsHash,
            url: ipfsService.getUrl(ipfsHash),
            message: 'File uploaded successfully to IPFS'
        });
    } catch (error: any) {
        console.error("Upload document error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getDocumentUrl = async (req: Request, res: Response) => {
    try {
        const { tradeId, docType } = req.params;

        let eventName = '';
        if (docType === 'LOC') eventName = 'LOC_UPLOADED';
        if (docType === 'BOL') eventName = 'GOODS_SHIPPED';

        if (!eventName) {
            return res.status(400).json({ message: 'Invalid document type. Use LOC or BOL.' });
        }

        const event = await (prisma.tradeEvent as any).findFirst({
            where: {
                tradeId,
                event: eventName,
                ipfsHash: { not: null }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!event || !event.ipfsHash) {
            return res.status(404).json({ message: 'Document not found for this trade' });
        }

        res.status(200).json({
            url: ipfsService.getUrl(event.ipfsHash),
            ipfsHash: event.ipfsHash
        });
    } catch (error: any) {
        console.error("Get document URL error:", error);
        res.status(500).json({ message: error.message });
    }
};
