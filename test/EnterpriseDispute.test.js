import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("TradeSphere - Enterprise Dispute & SLA Tests", function () {
  let tradeRegistry, letterOfCredit, docVerification, paymentSettlement, consensusDispute;
  let owner, importer, exporter, issuingBank, advisingBank, shipping, inspector, customs, insurance;

  beforeEach(async function () {
    [owner, importer, exporter, issuingBank, advisingBank, shipping, inspector, customs, insurance] = await ethers.getSigners();

    const TradeRegistry = await ethers.getContractFactory("TradeRegistry");
    tradeRegistry = await TradeRegistry.deploy();

    const LetterOfCredit = await ethers.getContractFactory("LetterOfCredit");
    letterOfCredit = await LetterOfCredit.deploy(await tradeRegistry.getAddress());

    const DocumentVerification = await ethers.getContractFactory("DocumentVerification");
    docVerification = await DocumentVerification.deploy(await tradeRegistry.getAddress());

    const PaymentSettlement = await ethers.getContractFactory("PaymentSettlement");
    paymentSettlement = await PaymentSettlement.deploy(await tradeRegistry.getAddress());

    const ConsensusDispute = await ethers.getContractFactory("ConsensusDispute");
    consensusDispute = await ConsensusDispute.deploy(await tradeRegistry.getAddress());

    // Authorize satellite contracts
    await tradeRegistry.setAuthorizedContract(await letterOfCredit.getAddress(), true);
    await tradeRegistry.setAuthorizedContract(await docVerification.getAddress(), true);
    await tradeRegistry.setAuthorizedContract(await paymentSettlement.getAddress(), true);
    await tradeRegistry.setAuthorizedContract(await consensusDispute.getAddress(), true);
  });

  it("Should handle Weighted Consensus (Inspector + Insurance = 3 pts) and Revert", async function () {
    const amount = ethers.parseEther("10");
    const shippingDeadline = Math.floor(Date.now() / 1000) + 86400;
    const clearanceDeadline = Math.floor(Date.now() / 1000) + 86400 * 2;

    // 1. Create Trade with all nodes
    await tradeRegistry.connect(importer).createTrade(
      exporter.address, issuingBank.address, advisingBank.address,
      inspector.address, customs.address, insurance.address,
      amount, shippingDeadline, clearanceDeadline
    );

    // 2. Progress to LOC_APPROVED and deposit escrow
    await tradeRegistry.connect(importer).confirmTrade(0);
    await tradeRegistry.connect(exporter).confirmTrade(0);
    await tradeRegistry.updateStatus(0, 2); // LOC_INITIATED
    await letterOfCredit.connect(issuingBank).uploadLocDocument(0, 0, "QmLoC");
    await letterOfCredit.connect(advisingBank).approveLoC(0);
    await paymentSettlement.connect(issuingBank).depositEscrow(0, { value: amount });

    let settlement = await paymentSettlement.getSettlement(0);
    expect(settlement.fundsLocked).to.equal(true);

    // 3. Inspector raises dispute
    await consensusDispute.connect(inspector).raiseDispute(0, "QmDamageEvidence");
    let trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(14); // DISPUTED

    // 4. Voting — Inspector (+2) + Insurance (+1) = 3 → threshold reached
    await consensusDispute.connect(inspector).castVote(0, 1); // REVERT
    await consensusDispute.connect(insurance).castVote(0, 1); // REVERT

    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(16); // TRADE_REVERTED_BY_CONSENSUS

    // 5. Refund — use owner to call so issuingBank balance is not affected by gas
    const initialBalance = await ethers.provider.getBalance(issuingBank.address);
    await paymentSettlement.connect(owner).refundImporter(0);
    const finalBalance = await ethers.provider.getBalance(issuingBank.address);

    expect(finalBalance - initialBalance).to.equal(amount);

    settlement = await paymentSettlement.getSettlement(0);
    expect(settlement.refunded).to.equal(true);
  });

  it("Should trigger SLA Breach Revert if shipping deadline passed", async function () {
    const amount = ethers.parseEther("5");
    const pastDeadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

    await tradeRegistry.connect(importer).createTrade(
      exporter.address, issuingBank.address, advisingBank.address,
      inspector.address, customs.address, insurance.address,
      amount, pastDeadline, 0
    );
    await tradeRegistry.connect(importer).confirmTrade(0);
    await tradeRegistry.connect(exporter).confirmTrade(0);
    await tradeRegistry.updateStatus(0, 2);
    await letterOfCredit.connect(issuingBank).uploadLocDocument(0, 0, "QmLoC");
    await letterOfCredit.connect(advisingBank).approveLoC(0);
    await paymentSettlement.connect(issuingBank).depositEscrow(0, { value: amount });

    // Trigger SLA Breach Revert
    await tradeRegistry.connect(issuingBank).triggerSLABreachRevert(0);
    const trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(16); // TRADE_REVERTED_BY_CONSENSUS
  });
});
