import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("TradeSphere Protocol – Full Lifecycle Tests", function () {
  let tradeRegistry, letterOfCredit, docVerification, paymentSettlement;
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

    // Authorize satellite contracts
    await tradeRegistry.setAuthorizedContract(await letterOfCredit.getAddress(), true);
    await tradeRegistry.setAuthorizedContract(await docVerification.getAddress(), true);
    await tradeRegistry.setAuthorizedContract(await paymentSettlement.getAddress(), true);
  });

  /**
   * Helper: Create a trade and advance to GOODS_SHIPPED
   */
  async function setupToGoodsShipped(amount) {
    const expiry = Math.floor(Date.now() / 1000) + 86400;
    const bolIpfs = "QmBillOfLadingHash456";

    await tradeRegistry.connect(importer).createTrade(
      exporter.address, issuingBank.address, advisingBank.address,
      inspector.address, customs.address, insurance.address,
      amount, 0, 0
    );
    await tradeRegistry.connect(importer).confirmTrade(0);
    await tradeRegistry.connect(exporter).confirmTrade(0);
    await tradeRegistry.updateStatus(0, 2); // LOC_INITIATED
    await letterOfCredit.connect(issuingBank).uploadLocDocument(0, expiry, "QmLoCDoc123");
    await letterOfCredit.connect(advisingBank).approveLoC(0);
    await letterOfCredit.connect(issuingBank).lockFunds(0);
    await tradeRegistry.connect(importer).assignShippingCompany(0, shipping.address);
    await docVerification.connect(shipping).issueBillOfLading(0, bolIpfs);

    return bolIpfs;
  }

  // ── Status Enum Reference ──
  // 0=OFFER_ACCEPTED, 1=TRADE_INITIATED, 2=LOC_INITIATED, 3=LOC_UPLOADED,
  // 4=LOC_APPROVED, 5=FUNDS_LOCKED, 6=SHIPPING_ASSIGNED, 7=GOODS_SHIPPED,
  // 8=CUSTOMS_CLEARED, 9=CUSTOMS_FLAGGED, 10=ENTRY_REJECTED, 11=VOTING_ACTIVE,
  // 12=GOODS_RECEIVED, 13=PAYMENT_AUTHORIZED, 14=SETTLEMENT_CONFIRMED,
  // 15=COMPLETED, 16=DISPUTED, 17=EXPIRED, 18=TRADE_REVERTED_BY_CONSENSUS,
  // 19=DISPUTE_RESOLVED_NO_REVERT, 20=CLAIM_PAYOUT_APPROVED

  it("Should prevent unauthorized status updates", async function () {
    await expect(
      tradeRegistry.connect(importer).updateStatus(0, 1)
    ).to.be.revertedWith("Not authorized");
  });

  it("Should authorize contracts correctly", async function () {
    const locAddress = await letterOfCredit.getAddress();
    expect(await tradeRegistry.authorizedContracts(locAddress)).to.equal(true);
  });

  it("Should complete full trade lifecycle — CLEAR path (decision 0)", async function () {
    const amount = ethers.parseEther("10");

    // Setup to GOODS_SHIPPED
    await setupToGoodsShipped(amount);

    let trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(7); // GOODS_SHIPPED

    // Customs decision: CLEAR (decision=0) → CUSTOMS_CLEARED
    await docVerification.connect(customs).verifyAsCustoms(0, 0, 0, "");
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(8); // CUSTOMS_CLEARED

    // Importer confirms goods received → GOODS_RECEIVED
    await tradeRegistry.connect(importer).confirmGoodsReceived(0);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(12); // GOODS_RECEIVED

    // Importer bank authorizes payment → PAYMENT_AUTHORIZED
    await paymentSettlement.connect(issuingBank).authorizePayment(0);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(13); // PAYMENT_AUTHORIZED

    // Exporter bank confirms settlement → COMPLETED
    await paymentSettlement.connect(advisingBank).confirmSettlement(0);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(15); // COMPLETED

    const settlement = await paymentSettlement.getSettlement(0);
    expect(settlement.settlementConfirmed).to.equal(true);
  });

  it("Should enforce CUSTOMS_FLAGGED → tax paid → CUSTOMS_CLEARED path (decision 1)", async function () {
    const amount = ethers.parseEther("5");
    const taxAmount = ethers.parseEther("0.5");

    await setupToGoodsShipped(amount);

    // Customs decision: FLAGS (decision=1) with tax of 0.5 ETH → CUSTOMS_FLAGGED
    await docVerification.connect(customs).verifyAsCustoms(0, 1, taxAmount, "");
    let trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(9); // CUSTOMS_FLAGGED

    // Verify tax amount stored
    const verification = await docVerification.getVerification(0);
    expect(verification.taxAmount).to.equal(taxAmount);

    // Customs confirms tax paid and releases → CUSTOMS_CLEARED
    await docVerification.connect(customs).payTaxAndRelease(0);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(8); // CUSTOMS_CLEARED

    // Chain continues: importer confirms goods → authorize → settle → complete
    await tradeRegistry.connect(importer).confirmGoodsReceived(0);
    await paymentSettlement.connect(issuingBank).authorizePayment(0);
    await paymentSettlement.connect(advisingBank).confirmSettlement(0);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(15); // COMPLETED
  });

  it("Should enforce ENTRY_REJECTED path (decision 2)", async function () {
    const amount = ethers.parseEther("5");

    await setupToGoodsShipped(amount);

    // Customs decision: ENTRY REJECTION (decision=2) → ENTRY_REJECTED
    await docVerification.connect(customs).verifyAsCustoms(0, 2, 0, "");
    const trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(10); // ENTRY_REJECTED
  });

  it("Should reject invalid customs decision codes", async function () {
    const amount = ethers.parseEther("5");
    await setupToGoodsShipped(amount);

    await expect(
      docVerification.connect(customs).verifyAsCustoms(0, 3, 0, "")
    ).to.be.revertedWith("Invalid decision code");
  });

  it("Should enforce state guards — cannot uploadLoC without LOC_INITIATED", async function () {
    const amount = ethers.parseEther("10");
    const expiry = Math.floor(Date.now() / 1000) + 86400;
    await tradeRegistry.connect(importer).createTrade(
      exporter.address, issuingBank.address, advisingBank.address,
      inspector.address, customs.address, insurance.address,
      amount, 0, 0
    );
    await expect(
      letterOfCredit.connect(issuingBank).uploadLocDocument(0, expiry, "QmHash")
    ).to.be.revertedWith("Trade must be in LOC_INITIATED status");
  });

  it("Should enforce BoL can only be issued after SHIPPING_ASSIGNED", async function () {
    const amount = ethers.parseEther("10");
    const expiry = Math.floor(Date.now() / 1000) + 86400;
    await tradeRegistry.connect(importer).createTrade(
      exporter.address, issuingBank.address, advisingBank.address,
      inspector.address, customs.address, insurance.address,
      amount, 0, 0
    );
    await tradeRegistry.connect(importer).confirmTrade(0);
    await tradeRegistry.connect(exporter).confirmTrade(0);
    await tradeRegistry.updateStatus(0, 2); // LOC_INITIATED
    await letterOfCredit.connect(issuingBank).uploadLocDocument(0, expiry, "QmLoC");
    await letterOfCredit.connect(advisingBank).approveLoC(0);
    // Status is LOC_APPROVED (not yet FUNDS_LOCKED) → assign shipping should fail
    await expect(
      tradeRegistry.connect(importer).assignShippingCompany(0, shipping.address)
    ).to.be.revertedWith("Funds not locked yet");
  });

  it("Should reject verifyAsCustoms if not customs authority", async function () {
    const amount = ethers.parseEther("5");
    await setupToGoodsShipped(amount);

    await expect(
      docVerification.connect(importer).verifyAsCustoms(0, 0, 0, "")
    ).to.be.revertedWith("Only Custom & Tax Authority");
  });

  it("Should require tax amount > 0 for FLAGS decision", async function () {
    const amount = ethers.parseEther("5");
    await setupToGoodsShipped(amount);

    await expect(
      docVerification.connect(customs).verifyAsCustoms(0, 1, 0, "")
    ).to.be.revertedWith("Tax amount must be > 0 for flagged goods");
  });
});
