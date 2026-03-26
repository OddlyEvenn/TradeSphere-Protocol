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

  // 2. Deploy LetterOfCredit (depends on TradeRegistry)
  const LetterOfCredit = await ethers.getContractFactory("LetterOfCredit");
  const letterOfCredit = await LetterOfCredit.deploy(tradeRegistryAddress);
  await letterOfCredit.waitForDeployment();
  const locAddress = await letterOfCredit.getAddress();
  console.log("LetterOfCredit deployed to:", locAddress);

  // 3. Deploy DocumentVerification (depends on TradeRegistry only)
  const DocumentVerification = await ethers.getContractFactory("DocumentVerification");
  const docVerification = await DocumentVerification.deploy(tradeRegistryAddress);
  await docVerification.waitForDeployment();
  const docVerificationAddress = await docVerification.getAddress();
  console.log("DocumentVerification deployed to:", docVerificationAddress);

  // 4. Deploy PaymentSettlement (depends on TradeRegistry)
  const PaymentSettlement = await ethers.getContractFactory("PaymentSettlement");
  const paymentSettlement = await PaymentSettlement.deploy(tradeRegistryAddress);
  await paymentSettlement.waitForDeployment();
  const paymentSettlementAddress = await paymentSettlement.getAddress();
  console.log("PaymentSettlement deployed to:", paymentSettlementAddress);

  // 5. Deploy ConsensusDispute (depends on TradeRegistry)
  const ConsensusDispute = await ethers.getContractFactory("ConsensusDispute");
  const consensusDispute = await ConsensusDispute.deploy(tradeRegistryAddress);
  await consensusDispute.waitForDeployment();
  const consensusDisputeAddress = await consensusDispute.getAddress();
  console.log("ConsensusDispute deployed to:", consensusDisputeAddress);

  // 6. Authorize satellite contracts in TradeRegistry
  console.log("\nAuthorizing satellite contracts in TradeRegistry...");
  await tradeRegistry.setAuthorizedContract(locAddress, true);
  await tradeRegistry.setAuthorizedContract(docVerificationAddress, true);
  await tradeRegistry.setAuthorizedContract(paymentSettlementAddress, true);
  await tradeRegistry.setAuthorizedContract(consensusDisputeAddress, true);
  console.log("Authorization complete.");

  console.log("\n--- Deployment Summary ---");
  console.log("TRADE_REGISTRY_ADDRESS=       ", tradeRegistryAddress);
  console.log("LETTER_OF_CREDIT_ADDRESS=     ", locAddress);
  console.log("DOCUMENT_VERIFICATION_ADDRESS=", docVerificationAddress);
  console.log("PAYMENT_SETTLEMENT_ADDRESS=   ", paymentSettlementAddress);
  console.log("CONSENSUS_DISPUTE_ADDRESS=    ", consensusDisputeAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
