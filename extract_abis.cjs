const fs = require('fs');
const path = require('path');

const contracts = [
  'TradeRegistry',
  'LetterOfCredit',
  'DocumentVerification',
  'PaymentSettlement'
];

const projectRoot = path.resolve(__dirname);
const artifactsDir = path.join(projectRoot, 'artifacts', 'contracts');
const backendOutputDir = path.join(projectRoot, 'backend', 'src', 'abis');
const frontendOutputDir = path.join(projectRoot, 'frontend', 'src', 'abis');

[backendOutputDir, frontendOutputDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

contracts.forEach(contract => {
  const filePath = path.join(artifactsDir, `${contract}.sol`, `${contract}.json`);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const abi = JSON.stringify(data.abi, null, 2);

    // Save to backend
    fs.writeFileSync(path.join(backendOutputDir, `${contract}.json`), abi);
    // Save to frontend
    fs.writeFileSync(path.join(frontendOutputDir, `${contract}.json`), abi);

    console.log(`✅ Sync'd ABI for ${contract} to both backend and frontend`);
  } else {
    console.error(`❌ Artifact not found for ${contract} at: ${filePath}`);
  }
});
