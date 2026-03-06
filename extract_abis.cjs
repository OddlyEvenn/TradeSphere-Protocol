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
const outputDir = path.join(projectRoot, 'backend', 'src', 'abis');

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
    console.log(`✅ Extracted ABI for ${contract}`);
  } else {
    console.error(`❌ Artifact not found for ${contract} at: ${filePath}`);
  }
});
