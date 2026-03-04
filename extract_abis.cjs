const fs = require('fs');
const path = require('path');

const contracts = [
  'TradeRegistry',
  'LetterOfCredit',
  'DocumentVerification',
  'PaymentSettlement'
];

const artifactsDir = 'c:/Users/evanc/Desktop/BLOCKCHAIN-TRADE_FINANCE/artifacts/contracts';
const outputDir = 'c:/Users/evanc/Desktop/BLOCKCHAIN-TRADE_FINANCE/backend/src/abis';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

contracts.forEach(contract => {
  const filePath = path.join(artifactsDir, `${contract}.sol`, `${contract}.json`);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    fs.writeFileSync(
      path.join(outputDir, `${contract}.json`),
      JSON.stringify(data.abi, null, 2)
    );
    console.log(`Extracted ABI for ${contract}`);
  } else {
    console.error(`Artifact not found for ${contract}`);
  }
});
