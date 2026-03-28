import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("TradeSphere – 7-Node Voting, Inspector Decisions & SLA Tests", function () {
  let tradeRegistry, letterOfCredit, docVerification, paymentSettlement, consensusDispute;
  let owner, importer, exporter, issuingBank, advisingBank, shipping, inspector, customs, insurance;

  beforeEach(async function () {
    [owner, importer, exporter, issuingBank, advisingBank, shipping, inspector, customs, insurance] =
      await ethers.getSigners();

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

  // ── Status Enum Reference ──
  // 0=OFFER_ACCEPTED, 1=TRADE_INITIATED, 2=LOC_INITIATED, 3=LOC_UPLOADED,
  // 4=LOC_APPROVED, 5=FUNDS_LOCKED, 6=SHIPPING_ASSIGNED, 7=GOODS_SHIPPED,
  // 8=CUSTOMS_CLEARED, 9=CUSTOMS_FLAGGED, 10=ENTRY_REJECTED, 11=VOTING_ACTIVE,
  // 12=GOODS_RECEIVED, 13=PAYMENT_AUTHORIZED, 14=SETTLEMENT_CONFIRMED,
  // 15=COMPLETED, 16=DISPUTED, 17=EXPIRED, 18=TRADE_REVERTED_BY_CONSENSUS,
  // 19=DISPUTE_RESOLVED_NO_REVERT, 20=CLAIM_PAYOUT_APPROVED

  /**
   * Helper: Setup trade to ENTRY_REJECTED with escrow deposited
   */
  async function setupToEntryRejected(amount) {
    const shippingDeadline = Math.floor(Date.now() / 1000) + 86400;
    const clearanceDeadline = Math.floor(Date.now() / 1000) + 86400 * 2;

    await tradeRegistry.connect(importer).createTrade(
      exporter.address, issuingBank.address, advisingBank.address,
      inspector.address, customs.address, insurance.address,
      amount, shippingDeadline, clearanceDeadline
    );
    await tradeRegistry.connect(importer).confirmTrade(0);
    await tradeRegistry.connect(exporter).confirmTrade(0);
    await tradeRegistry.updateStatus(0, 2); // LOC_INITIATED
    await letterOfCredit.connect(issuingBank).uploadLocDocument(0, 0, "QmLoC");
    await letterOfCredit.connect(advisingBank).approveLoC(0);
    await paymentSettlement.connect(issuingBank).depositEscrow(0, { value: amount });

    // Assign shipping and ship goods
    await tradeRegistry.connect(importer).assignShippingCompany(0, shipping.address);
    await docVerification.connect(shipping).issueBillOfLading(0, "QmBoL");

    // Customs rejects entry
    await docVerification.connect(customs).verifyAsCustoms(0, 2, 0, "");

    let trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(10); // ENTRY_REJECTED
  }

  it("Should activate 7-node voting after ENTRY_REJECTED", async function () {
    const amount = ethers.parseEther("10");
    await setupToEntryRejected(amount);

    // Activate voting
    await consensusDispute.connect(inspector).activateVoting(0, "QmDamageEvidence");
    const trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(11); // VOTING_ACTIVE

    // Verify voting deadline was set (24 hours from now)
    expect(trade.votingDeadline).to.be.gt(0);

    // Verify voting summary
    const summary = await consensusDispute.getVotingSummary(0);
    expect(summary.active).to.equal(true);
    expect(summary.finalized).to.equal(false);
  });

  it("Should REVERT trade when >= 4 votes for REVERT", async function () {
    const amount = ethers.parseEther("10");
    await setupToEntryRejected(amount);

    await consensusDispute.connect(inspector).activateVoting(0, "QmEvidence");

    // Cast 4 REVERT votes (threshold = 4)
    await consensusDispute.connect(importer).castVote(0, 1);    // REVERT
    await consensusDispute.connect(inspector).castVote(0, 1);   // REVERT
    await consensusDispute.connect(insurance).castVote(0, 1);   // REVERT
    await consensusDispute.connect(issuingBank).castVote(0, 1); // REVERT → threshold hit

    const trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(18); // TRADE_REVERTED_BY_CONSENSUS

    // Verify refund works
    const initialBalance = await ethers.provider.getBalance(issuingBank.address);
    await paymentSettlement.connect(owner).refundImporter(0);
    const finalBalance = await ethers.provider.getBalance(issuingBank.address);
    expect(finalBalance - initialBalance).to.equal(amount);

    const settlement = await paymentSettlement.getSettlement(0);
    expect(settlement.refunded).to.equal(true);
  });

  it("Should NOT revert trade when < 4 votes for REVERT", async function () {
    const amount = ethers.parseEther("10");
    await setupToEntryRejected(amount);

    await consensusDispute.connect(inspector).activateVoting(0, "QmEvidence");

    // Cast 3 REVERT + 4 NO_REVERT (all 7 nodes vote)
    await consensusDispute.connect(importer).castVote(0, 1);      // REVERT
    await consensusDispute.connect(inspector).castVote(0, 1);     // REVERT
    await consensusDispute.connect(insurance).castVote(0, 1);     // REVERT
    await consensusDispute.connect(issuingBank).castVote(0, 2);   // NO_REVERT
    await consensusDispute.connect(advisingBank).castVote(0, 2);  // NO_REVERT
    await consensusDispute.connect(customs).castVote(0, 2);       // NO_REVERT
    await consensusDispute.connect(exporter).castVote(0, 2);      // NO_REVERT → all 7 voted

    const trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(19); // DISPUTE_RESOLVED_NO_REVERT
  });

  it("Should allow Inspector to submit field decision (cargo damaged)", async function () {
    const amount = ethers.parseEther("10");
    await setupToEntryRejected(amount);

    await consensusDispute.connect(inspector).activateVoting(0, "QmEvidence");

    // Inspector submits decision: cargo damaged
    await consensusDispute.connect(inspector).submitInspectorDecision(
      0,
      true,          // agrees with rejection
      1,             // CargoStatus.DAMAGED
      "Physical damage observed on containers"
    );

    const [submitted, decision, cargoStatus, notes] = await consensusDispute.getInspectorDecision(0);
    expect(submitted).to.equal(true);
    expect(decision).to.equal(true);
    expect(cargoStatus).to.equal(1); // DAMAGED
    expect(notes).to.equal("Physical damage observed on containers");
  });

  it("Should route to CLAIM_PAYOUT_APPROVED when cargo damaged + votes < threshold", async function () {
    const amount = ethers.parseEther("10");
    await setupToEntryRejected(amount);

    await consensusDispute.connect(inspector).activateVoting(0, "QmEvidence");

    // Inspector marks cargo as damaged
    await consensusDispute.connect(inspector).submitInspectorDecision(0, true, 1, "Damaged cargo");

    // Cast 3 REVERT + 4 NO_REVERT (below threshold)
    await consensusDispute.connect(importer).castVote(0, 1);      // REVERT
    await consensusDispute.connect(inspector).castVote(0, 1);     // REVERT
    await consensusDispute.connect(insurance).castVote(0, 1);     // REVERT
    await consensusDispute.connect(issuingBank).castVote(0, 2);   // NO_REVERT
    await consensusDispute.connect(advisingBank).castVote(0, 2);  // NO_REVERT
    await consensusDispute.connect(customs).castVote(0, 2);       // NO_REVERT
    await consensusDispute.connect(exporter).castVote(0, 2);      // NO_REVERT

    const trade = await tradeRegistry.getTrade(0);
    // Cargo damaged + votes < 4 → insurance payout approved for exporter
    expect(trade.status).to.equal(20); // CLAIM_PAYOUT_APPROVED

    // Exporter gets insurance payout
    const initialBalance = await ethers.provider.getBalance(exporter.address);
    await paymentSettlement.connect(owner).payoutInsurance(0);
    const finalBalance = await ethers.provider.getBalance(exporter.address);
    expect(finalBalance - initialBalance).to.equal(amount);
  });

  it("Should allow voting finalization after 24hr deadline", async function () {
    const amount = ethers.parseEther("10");
    await setupToEntryRejected(amount);

    await consensusDispute.connect(inspector).activateVoting(0, "QmEvidence");

    // Only 2 nodes vote (below threshold)
    await consensusDispute.connect(importer).castVote(0, 1);    // REVERT
    await consensusDispute.connect(inspector).castVote(0, 1);   // REVERT

    // Fast-forward 24 hours + 1 second
    await ethers.provider.send("evm_increaseTime", [86401]);
    await ethers.provider.send("evm_mine");

    // Anyone can finalize after deadline
    await consensusDispute.connect(owner).finalizeVoting(0);

    const trade = await tradeRegistry.getTrade(0);
    // Only 2 REVERT votes < 4 threshold → no revert
    expect(trade.status).to.equal(19); // DISPUTE_RESOLVED_NO_REVERT
  });

  it("Should prevent voting after deadline expires", async function () {
    const amount = ethers.parseEther("10");
    await setupToEntryRejected(amount);

    await consensusDispute.connect(inspector).activateVoting(0, "QmEvidence");

    // Fast-forward 24 hours + 1 second
    await ethers.provider.send("evm_increaseTime", [86401]);
    await ethers.provider.send("evm_mine");

    // Voting should fail after deadline
    await expect(
      consensusDispute.connect(importer).castVote(0, 1)
    ).to.be.revertedWith("Voting period expired - call finalizeVoting");
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
    expect(trade.status).to.equal(18); // TRADE_REVERTED_BY_CONSENSUS
  });

  it("Should prevent double voting", async function () {
    const amount = ethers.parseEther("10");
    await setupToEntryRejected(amount);

    await consensusDispute.connect(inspector).activateVoting(0, "QmEvidence");
    await consensusDispute.connect(importer).castVote(0, 1); // REVERT

    await expect(
      consensusDispute.connect(importer).castVote(0, 1)
    ).to.be.revertedWith("Already voted");
  });

  it("Should prevent non-voting-nodes from casting votes", async function () {
    const amount = ethers.parseEther("10");
    await setupToEntryRejected(amount);

    await consensusDispute.connect(inspector).activateVoting(0, "QmEvidence");

    // shipping is not a voting node
    await expect(
      consensusDispute.connect(shipping).castVote(0, 1)
    ).to.be.revertedWith("Not a voting node");
  });

  it("Should trigger SLA breach auto-finalize", async function () {
    const amount = ethers.parseEther("10");
    await setupToEntryRejected(amount);

    await consensusDispute.connect(inspector).activateVoting(0, "QmEvidence");

    // Cast 1 REVERT vote
    await consensusDispute.connect(importer).castVote(0, 1);

    // Fast forward past deadline
    await ethers.provider.send("evm_increaseTime", [86401]);
    await ethers.provider.send("evm_mine");

    // Trigger SLA breach
    await consensusDispute.connect(owner).triggerVotingSLABreach(0);

    const trade = await tradeRegistry.getTrade(0);
    // Only 1 REVERT vote < 4 threshold → no revert
    expect(trade.status).to.equal(19); // DISPUTE_RESOLVED_NO_REVERT
  });
});
