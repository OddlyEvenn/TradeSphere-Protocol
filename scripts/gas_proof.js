import hre from "hardhat";

async function main() {
    const [owner, importer, exporter, bank1, bank2, shipper, customs, insurance] = await hre.ethers.getSigners();

    // Deploy Contracts
    const TradeRegistry = await hre.ethers.getContractFactory("TradeRegistry");
    const registryOpt = await TradeRegistry.deploy();
    await registryOpt.waitForDeployment();

    const TradeRegistryUnopt = await hre.ethers.getContractFactory("TradeRegistryUnoptimized");
    const registryUnopt = await TradeRegistryUnopt.deploy();
    await registryUnopt.waitForDeployment();

    // ── MEASURE: createTrade ───────────────────────────────────────────────
    const txOpt1 = await registryOpt.createTrade(
        exporter.address, bank1.address, bank2.address, shipper.address, 
        customs.address, insurance.address, hre.ethers.parseEther("1"), 
        Math.floor(Date.now() / 1000) + 86400, Math.floor(Date.now() / 1000) + 172800
    );
    const receiptOpt1 = await txOpt1.wait();

    const txUnopt1 = await registryUnopt.createTrade(
        exporter.address, bank1.address, bank2.address, shipper.address, 
        customs.address, insurance.address, hre.ethers.parseEther("1"), 
        Math.floor(Date.now() / 1000) + 86400, Math.floor(Date.now() / 1000) + 172800
    );
    const receiptUnopt1 = await txUnopt1.wait();

    // ── MEASURE: updateStatus ──────────────────────────────────────────────
    await registryOpt.setAuthorizedContract(owner.address, true);
    const txOpt2 = await registryOpt.updateStatus(0, 1);
    const receiptOpt2 = await txOpt2.wait();

    await registryUnopt.setAuthorizedContract(owner.address, true);
    const txUnopt2 = await registryUnopt.updateStatus(0, 1);
    const receiptUnopt2 = await txUnopt2.wait();

    // ── OUTPUT FORMAT ─────────────────────────────────────────────────────
    console.log("\n--- UNOPTIMIZED (BEFORE) ---");
    console.log(`Gas used for 'createTrade': ${receiptUnopt1.gasUsed.toString()}`);
    console.log(`Gas used for 'updateStatus': ${receiptUnopt2.gasUsed.toString()}`);

    console.log("\n--- OPTIMIZED (AFTER) ---");
    console.log(`Gas used for 'createTrade': ${receiptOpt1.gasUsed.toString()}`);
    console.log(`Gas used for 'updateStatus': ${receiptOpt2.gasUsed.toString()}`);
    console.log("");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
