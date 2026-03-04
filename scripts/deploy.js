import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. Deploy TradeRegistry
  const TradeRegistry = await ethers.getContractFactory("TradeRegistry");
  const tradeRegistry = await TradeRegistry.deploy();
  await tradeRegistry.waitForDeployment();
  const tradeRegistryAddress = await tradeRegistry.getAddress();
  console.log("TradeRegistry deployed to:", tradeRegistryAddress);

  // 2. Deploy LetterOfCredit
  const LetterOfCredit = await ethers.getContractFactory("LetterOfCredit");
  const letterOfCredit = await LetterOfCredit.deploy(tradeRegistryAddress);
  await letterOfCredit.waitForDeployment();
  const locAddress = await letterOfCredit.getAddress();
  console.log("LetterOfCredit deployed to:", locAddress);

  // 3. Deploy DocumentVerification
  // For demo purposes, we'll use the deployer as the Customs address
  const DocumentVerification = await ethers.getContractFactory("DocumentVerification");
  const docVerification = await DocumentVerification.deploy(tradeRegistryAddress, deployer.address);
  await docVerification.waitForDeployment();
  const docVerificationAddress = await docVerification.getAddress();
  console.log("DocumentVerification deployed to:", docVerificationAddress);

  // 4. Deploy PaymentSettlement
  const PaymentSettlement = await ethers.getContractFactory("PaymentSettlement");
  const paymentSettlement = await PaymentSettlement.deploy(tradeRegistryAddress, docVerificationAddress);
  await paymentSettlement.waitForDeployment();
  const paymentSettlementAddress = await paymentSettlement.getAddress();
  console.log("PaymentSettlement deployed to:", paymentSettlementAddress);

  // 5. Authorize contracts in TradeRegistry
  console.log("Authorizing contracts in TradeRegistry...");
  await tradeRegistry.setAuthorizedContract(locAddress, true);
  await tradeRegistry.setAuthorizedContract(docVerificationAddress, true);
  await tradeRegistry.setAuthorizedContract(paymentSettlementAddress, true);
  console.log("Authorization complete.");

  console.log("\n--- Deployment Summary ---");
  console.log("TradeRegistry:", tradeRegistryAddress);
  console.log("LetterOfCredit:", locAddress);
  console.log("DocumentVerification:", docVerificationAddress);
  console.log("PaymentSettlement:", paymentSettlementAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
