const { ethers } = require("hardhat");
const path = require("path");
const fs = require("fs");

/**
 * SHOWCASE SERVER LAUNCHER - AUTO-SYNC VERSION
 * This script runs a standalone listener for the [OS-KERNEL] logs.
 * It automatically reads the latest local contract addresses from showcase_config.json.
 */

async function main() {
  console.clear();
  console.log("==========================================");
  console.log("📡  SYSTEM: REAL-TIME CONCURRENCY MONITOR");
  console.log("==========================================");

  const showcasePath = path.join(__dirname, 'showcase_config.json');

  if (!fs.existsSync(showcasePath)) {
    console.log("❌ CONFIG_MISSING: Run simulation first.");
    process.exit(1);
  }

  const { registryAddr, disputeAddr } = JSON.parse(fs.readFileSync(showcasePath, 'utf8'));

  console.log(`📡 LINKED_CONTRACT: ${disputeAddr}`);
  console.log("------------------------------------------");

  const consensusDispute = await ethers.getContractAt("ConsensusDispute", disputeAddr);

  // Define the logging function
  const logVote = (tradeId, voter, vote, isHistorical = false) => {
    const voteStr = Number(vote) === 1 ? "REVERT" : "NO_REVERT";
    const type = isHistorical ? "SYNC" : "LIVE";
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`[\x1b[36m${timestamp}\x1b[0m] [${type}] [MEMPOOL] VOTE_CAST: ${voter.substring(0, 8)}... | OP: ${voteStr}`);
    console.log(`[\x1b[36m${timestamp}\x1b[0m] [${type}] [KERNEL] MUTEX_LOCK: TRADE_${tradeId} | UPDATING_STATE`);
  };

  // Sync historical
  const pastVotes = await consensusDispute.queryFilter("VoteCast");
  if (pastVotes.length > 0) {
    pastVotes.forEach(event => {
      logVote(event.args[0], event.args[1], event.args[2], true);
    });
  }

  consensusDispute.on("VoteCast", (tradeId, voter, vote) => {
    logVote(tradeId, voter, vote, false);
  });

  consensusDispute.on("VotingFinalized", (tradeId, revertVotes, noRevertVotes) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\x1b[32m[\x1b[0m${timestamp}\x1b[32m] [FINAL] CONSENSUS_REACHED: ${revertVotes} vs ${noRevertVotes}\x1b[0m`);
    console.log(`\x1b[32m[\x1b[0m${timestamp}\x1b[32m] [FINAL] DETERMINISTIC_EXIT: SUCCESS\x1b[0m`);
  });

  // Keep process alive
  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
