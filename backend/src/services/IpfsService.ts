// @ts-expect-error: Pinata SDK lacks official TypeScript type definitions
import pinataSDK from '@pinata/sdk';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import os from 'os';

dotenv.config();

// We'll use the Pinata SDK. Need to ensure PINATA_API_KEY and PINATA_SECRET_API_KEY are in .env
const pinataApiKey = process.env.PINATA_API_KEY || '';
const pinataApiSecret = process.env.PINATA_SECRET_API_KEY || '';

class IpfsService {
    private pinata: any;

    constructor() {
        if (pinataApiKey && pinataApiSecret) {
            this.pinata = new pinataSDK(pinataApiKey, pinataApiSecret);
        } else {
            console.warn('⚠️ Pinata API keys not found in .env. IPFS uploads will fail or be mocked.');
        }
    }

    /**
     * Uploads a file buffer to Pinata IPFS
     * @param buffer The file buffer
     * @param filename Original filename for metadata
     * @returns The IPFS Hash (CID)
     */
    public async uploadFile(buffer: Buffer, filename: string): Promise<string> {
        if (!this.pinata) {
            console.warn('Mocking IPFS upload since Pinata is not configured.');
            return `QmMockHash_${Date.now()}`;
        }

        try {
            // Pinata SDK typically takes a readable stream. Let's write the buffer to a temp file and read it.
            const tempFilePath = path.join(os.tmpdir(), `${Date.now()}_${filename}`);
            fs.writeFileSync(tempFilePath, buffer);
            const readableStreamForFile = fs.createReadStream(tempFilePath);

            const options = {
                pinataMetadata: {
                    name: filename
                }
            };

            console.log(`Uploading ${filename} to IPFS...`);
            const result = await this.pinata.pinFileToIPFS(readableStreamForFile, options);

            // Clean up temp file
            fs.unlinkSync(tempFilePath);

            console.log(`✅ File uploaded to IPFS: ${result.IpfsHash}`);
            return result.IpfsHash;
        } catch (error) {
            console.error('❌ IPFS Upload Error:', error);
            throw new Error('Failed to upload file to IPFS');
        }
    }

    /**
     * Returns the gateway URL for a given IPFS hash
     */
    public getUrl(ipfsHash: string): string {
        const gateway = process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs';
        return `${gateway}/${ipfsHash}`;
    }
}

export const ipfsService = new IpfsService();
