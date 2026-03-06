import { ipfsService } from './src/services/IpfsService';

async function testPinata() {
    console.log("Starting Pinata IPFS Test...");

    // Create a simple dummy text file buffer
    const dummyText = "This is a test document for TradeSphere Protocol IPFS integration. Timestamp: " + new Date().toISOString();
    const buffer = Buffer.from(dummyText, 'utf-8');

    try {
        console.log("Calling uploadFile...");
        const ipfsHash = await ipfsService.uploadFile(buffer, 'test-document.txt');

        console.log("\n✅ SUCCESS!");
        console.log("IPFS Hash:  ", ipfsHash);
        console.log("Gateway URL:", ipfsService.getUrl(ipfsHash));

        console.log("\nYou should be able to view this text in your browser at the URL above.");
    } catch (error) {
        console.error("\n❌ FAILED:");
        console.error(error);
    }
}

testPinata();
