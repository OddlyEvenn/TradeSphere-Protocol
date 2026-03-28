import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contractsDir = path.join(__dirname, 'artifacts', 'contracts');
const backendAbisDir = path.join(__dirname, 'backend', 'src', 'abis');
const frontendAbisDir = path.join(__dirname, 'frontend', 'src', 'abis');

const contractsToSync = [
    'TradeRegistry',
    'LetterOfCredit',
    'DocumentVerification',
    'PaymentSettlement',
    'ConsensusDispute'
];

function syncAbis() {
    console.log('Syncing ABIs...');
    
    // Ensure destination dirs exist
    if (!fs.existsSync(backendAbisDir)) fs.mkdirSync(backendAbisDir, { recursive: true });
    if (!fs.existsSync(frontendAbisDir)) fs.mkdirSync(frontendAbisDir, { recursive: true });

    contractsToSync.forEach(contract => {
        const sourcePath = path.join(contractsDir, `${contract}.sol`, `${contract}.json`);
        
        if (fs.existsSync(sourcePath)) {
            const destBackend = path.join(backendAbisDir, `${contract}.json`);
            const destFrontend = path.join(frontendAbisDir, `${contract}.json`);
            
            fs.copyFileSync(sourcePath, destBackend);
            fs.copyFileSync(sourcePath, destFrontend);
            console.log(`✅ Synced ${contract}.json to frontend and backend.`);
        } else {
            console.error(`❌ Source ABI not found: ${sourcePath}`);
        }
    });

    console.log('Done!');
}

syncAbis();
