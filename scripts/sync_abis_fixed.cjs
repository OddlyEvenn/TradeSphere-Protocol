const fs = require('fs');
const path = require('path');

/**
 * sync_abis_fixed.cjs - CommonJS Version
 * 
 * Automatically copies the latest compiled ABIs from Hardhat artifacts 
 * into the Backend and Frontend folders.
 */

const contracts = [
  "TradeRegistry",
  "LetterOfCredit",
  "DocumentVerification",
  "PaymentSettlement",
  "ConsensusDispute"
];

const ARTIFACT_BASE_PATH = path.join(__dirname, "../artifacts/contracts");
const BACKEND_ABI_PATH = path.join(__dirname, "../backend/src/abis");
const FRONTEND_ABI_PATH = path.join(__dirname, "../frontend/src/abis");

console.log("🔍 Checking artifacts at:", ARTIFACT_BASE_PATH);

// Ensure directories exist
[BACKEND_ABI_PATH, FRONTEND_ABI_PATH].forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`📂 Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
});

contracts.forEach(contractName => {
  // Hardhat stores artifacts in contractName.sol/contractName.json
  const artifactPath = path.join(ARTIFACT_BASE_PATH, `${contractName}.sol/${contractName}.json`);
  
  if (fs.existsSync(artifactPath)) {
    try {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      const abi = JSON.stringify(artifact.abi, null, 2);
      const fileName = `${contractName}.json`;

      // Copy to Backend
      fs.writeFileSync(path.join(BACKEND_ABI_PATH, fileName), abi);
      
      // Copy to Frontend
      fs.writeFileSync(path.join(FRONTEND_ABI_PATH, fileName), abi);

      console.log(`✅ Synced ABI for ${contractName}`);
    } catch (error) {
      console.error(`❌ Error parsing artifact for ${contractName}:`, error.message);
    }
  } else {
    console.warn(`⚠️ Artifact not found for ${contractName} at: ${artifactPath}`);
  }
});

console.log("\n🚀 All ABIs are now synchronized across project folders!");
