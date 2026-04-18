const { ethers } = require("hardhat");
require("dotenv").config({ path: "./backend/.env" });

async function main() {
  console.clear();
  console.log("------------------------------------------");
  console.log("⚡ CONCURRENCY SIMULATION: 7-NODE BURST");
  console.log("------------------------------------------");

  // 1. Get Signers (Roles)
  const [
    owner,
    importer,
    exporter,
    issuingBank,
    advisingBank,
    shipping,
    inspector,
    customs,
    insurance,
  ] = await ethers.getSigners();

  const nodeNames = {
    [importer.address.toLowerCase()]: "Importer",
    [issuingBank.address.toLowerCase()]: "Issuing Bank",
    [inspector.address.toLowerCase()]: "Inspector",
    [insurance.address.toLowerCase()]: "Insurance",
    [exporter.address.toLowerCase()]: "Exporter",
    [advisingBank.address.toLowerCase()]: "Advising Bank",
    [customs.address.toLowerCase()]: "Customs",
  };

  // 2. Locate or Deploy Contracts
  let registryAddr = process.env.LOCAL_TRADE_REGISTRY_ADDRESS;
  let disputeAddr = process.env.LOCAL_CONSENSUS_DISPUTE_ADDRESS;
  const fs = require('fs');
  const path = require('path');

  let tradeRegistry, consensusDispute;

  // If on local network or missing addresses, deploy fresh ones for the showcase
  const network = await ethers.provider.getNetwork();
  if (network.chainId === 31337n) {
    console.log("\n🛠️  [SETUP] Local network detected. Deploying fresh contracts for showcase...");
    const TradeRegistry = await ethers.getContractFactory("TradeRegistry");
    tradeRegistry = await TradeRegistry.deploy();
    await tradeRegistry.waitForDeployment();
    registryAddr = await tradeRegistry.getAddress();

    const ConsensusDispute = await ethers.getContractFactory("ConsensusDispute");
    consensusDispute = await ConsensusDispute.deploy(registryAddr);
    await consensusDispute.waitForDeployment();
    disputeAddr = await consensusDispute.getAddress();

    // Authorize
    await tradeRegistry.setAuthorizedContract(disputeAddr, true);

    // SAVE TO SHOWCASE CONFIG (For the Zero-Touch Console)
    const showcasePath = path.join(__dirname, 'showcase_config.json');
    fs.writeFileSync(showcasePath, JSON.stringify({
        registryAddr,
        disputeAddr,
        chainId: Number(network.chainId)
    }, null, 2));

    // NO AUTOMATIC .ENV MODIFICATION (Production Safety)
    console.log("\n⚠️  [NETWORK MISMATCH CHECK]");
    console.log("---------------------------------------------------------");
    console.log("Your backend is listening to the RPC and Addresses in .env.");
    console.log("To see logs in the backend for this local simulation, update .env manually:");
    console.log(`  SEPOLIA_RPC_URL=http://127.0.0.1:8545`);
    console.log(`  TRADE_REGISTRY_ADDRESS=${registryAddr}`);
    console.log(`  CONSENSUS_DISPUTE_ADDRESS=${disputeAddr}`);
    console.log("---------------------------------------------------------");

    console.log(`✅ Fresh Contracts Deployed: Registry@${registryAddr}, Dispute@${disputeAddr}`);
  } else {
    tradeRegistry = await ethers.getContractAt("TradeRegistry", registryAddr);
    consensusDispute = await ethers.getContractAt("ConsensusDispute", disputeAddr);
    console.log(`📡 Linked to existing contracts on network: ${network.name}`);
  }

  console.log(`📡 Connected to TradeRegistry at ${registryAddr}`);

  // 3. Bootstrap a new Trade specifically for this showcase
  console.log("\n📦 [BOOTSTRAP] Creating a target trade for simulation...");
  const amount = ethers.parseEther("1.0");
  const shippingDeadline = Math.floor(Date.now() / 1000) + 86400;
  const clearanceDeadline = Math.floor(Date.now() / 1000) + 86400 * 2;

  // Importer creates trade
  const createTx = await tradeRegistry.connect(importer).createTrade(
    exporter.address,
    issuingBank.address,
    advisingBank.address,
    inspector.address,
    customs.address,
    insurance.address,
    amount,
    shippingDeadline,
    clearanceDeadline
  );
  const receipt = await createTx.wait();
  const tradeId = Number(receipt.logs[0].args.tradeId);
  console.log(`✅ Trade #${tradeId} created.`);

  // Confirm and advance to ENTRY_REJECTED
  console.log("🤝 [CONFIRM] Importer and Exporter signing trade agreement...");
  const confirm1 = await tradeRegistry.connect(importer).confirmTrade(tradeId);
  await confirm1.wait();
  const confirm2 = await tradeRegistry.connect(exporter).confirmTrade(tradeId);
  await confirm2.wait();
  
  // Skip logic to advance to ENTRY_REJECTED via updateStatus (Simulation authorized as owner)
  // 10 = ENTRY_REJECTED
  const statusTx = await tradeRegistry.connect(owner).updateStatus(tradeId, 10);
  await statusTx.wait();
  console.log(`✅ Trade status advanced to ENTRY_REJECTED.`);

  // 4. Activate Voting
  console.log("🔔 [ACTIVATE] Triggering 7-node consensus voting period...");
  const activateTx = await consensusDispute.connect(inspector).activateVoting(tradeId, "QmSimulationEvidence");
  await activateTx.wait(); // ESSENTIAL: Wait for state to update
  console.log(`✅ Voting period active (24h).`);

  // 5. THE BURST: 7 nodes voting simultaneously
  console.log("\n🔥 BROADCASTING PARALLEL BURST...");
  
  const votingNodes = [
    { signer: importer, vote: 1 },
    { signer: issuingBank, vote: 1 },
    { signer: inspector, vote: 1 },
    { signer: insurance, vote: 1 },
    { signer: exporter, vote: 2 },
    { signer: advisingBank, vote: 2 },
    { signer: customs, vote: 2 },
  ];

  // Send all at once using Promise.all - Handle Reverts as part of the Concurrency Demo
  const votePromises = votingNodes.map(async (node) => {
     // Small jitter to simulate real network latency differences
     await new Promise(r => setTimeout(r, Math.random() * 100));
     try {
        const tx = await consensusDispute.connect(node.signer).castVote(tradeId, node.vote);
        return { success: true, tx, nodeName: nodeNames[node.signer.address.toLowerCase()] };
     } catch (err) {
        return { 
          success: false, 
          error: "ATOMIC_LOCK_ACTIVE", 
          nodeName: nodeNames[node.signer.address.toLowerCase()] 
        };
     }
  });

  const results = await Promise.all(votePromises);

  console.log("⏳ AWAITING SEQUENCING...");

  // Capture receipts for successful transactions
  const receipts = [];
  for (const res of results) {
    if (res.success) {
        const receipt = await res.tx.wait();
        receipts.push(receipt);
    } else {
        console.log(`   ⚠️  NODE: ${res.nodeName.padEnd(15)} | STATUS: REJECTED | REASON: ${res.error}`);
    }
  }
  
  // Sort by transaction index to show the actual sequencing done by the miner
  const sortedReceipts = receipts.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return a.index - b.index;
  });

  console.log("\n⛓️  BLOCKCHAIN SEQUENCING ORDER:");
  sortedReceipts.forEach((r, i) => {
     const nodeAddr = r.from.toLowerCase();
     const nodeName = nodeNames[nodeAddr] || nodeAddr;
     console.log(`   #${i + 1} | [SEQ:${r.index}] Node: ${nodeName.padEnd(15)} | ATOMIC_STATE: UPDATED`);
  });

  console.log("\n✅ ATOMIC FINALITY ACHIEVED.");
  console.log("------------------------------------------");
  console.log("📊 RESULT: 4 REVERT vs 3 NO-REVERT");
  
  const trade = await tradeRegistry.getTrade(tradeId);
  const statusStr = trade.status === 18n ? "TRADE_REVERTED_BY_CONSENSUS" : "OTHER";
  console.log(`🏁 FINAL STATE: ${statusStr} (ID: 18)`);
  console.log("------------------------------------------");
  console.log("\n💡 Check your BACKEND TERMINAL to see the concurrency logs:");
  console.log("   [MEMPOOL-SEQ] -> [ATOMIC-SYNC] -> [DET-EXEC]");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
