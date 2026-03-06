import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("TradeSphere Protocol – Phase 2 Full Lifecycle", function () {
  let tradeRegistry, letterOfCredit, docVerification, paymentSettlement;
  let owner, importer, exporter, issuingBank, advisingBank, shipping;

  beforeEach(async function () {
    [owner, importer, exporter, issuingBank, advisingBank, shipping] = await ethers.getSigners();

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

  it("Should prevent unauthorized status updates", async function () {
    await expect(
      tradeRegistry.connect(importer).updateStatus(0, 1)
    ).to.be.revertedWith("Not authorized");
  });

  it("Should authorize contracts correctly", async function () {
    const locAddress = await letterOfCredit.getAddress();
    expect(await tradeRegistry.authorizedContracts(locAddress)).to.equal(true);
  });

  it("Should facilitate full trade lifecycle — OFFER_ACCEPTED → COMPLETED", async function () {
    const amount = ethers.parseEther("10");
    const expiry = Math.floor(Date.now() / 1000) + 86400; // 24h
    const locIpfs = "QmLoCDocumentHash123";
    const bolIpfs = "QmBillOfLadingHash456";

    // ── Step 1: Create Trade (status = OFFER_ACCEPTED) ──────────────────
    await tradeRegistry.connect(importer).createTrade(
      exporter.address, issuingBank.address, advisingBank.address, amount
    );
    let trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(0); // OFFER_ACCEPTED

    // ── Step 2: Both parties confirm → TRADE_INITIATED ──────────────────
    await tradeRegistry.connect(importer).confirmTrade(0);
    await tradeRegistry.connect(exporter).confirmTrade(0);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(1); // TRADE_INITIATED

    // ── Step 3: Move to LOC_INITIATED (done by backend updateStatus) ────
    await tradeRegistry.updateStatus(0, 2); // LOC_INITIATED
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(2); // LOC_INITIATED

    // ── Step 4: Importer bank uploads LoC doc → LOC_UPLOADED ────────────
    await letterOfCredit.connect(issuingBank).uploadLocDocument(0, expiry, locIpfs);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(3); // LOC_UPLOADED

    // Verify IPFS hash stored on-chain
    const loc = await letterOfCredit.getLoC(0);
    expect(loc.locDocIpfsHash).to.equal(locIpfs);

    // ── Step 5: Exporter bank approves LoC → LOC_APPROVED ───────────────
    await letterOfCredit.connect(advisingBank).approveLoC(0);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(4); // LOC_APPROVED

    // ── Step 6: Importer bank locks funds → FUNDS_LOCKED ────────────────
    await letterOfCredit.connect(issuingBank).lockFunds(0);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(5); // FUNDS_LOCKED

    // ── Step 7: Assign shipping company ─────────────────────────────────
    await tradeRegistry.connect(importer).assignShippingCompany(0, shipping.address);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.shippingCompany).to.equal(shipping.address);

    // ── Step 8: Shipping issues BoL → GOODS_SHIPPED ─────────────────────
    await docVerification.connect(shipping).issueBillOfLading(0, bolIpfs);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(6); // GOODS_SHIPPED

    // Verify BoL IPFS hash on-chain
    const bolHash = await docVerification.getBolIpfsHash(0);
    expect(bolHash).to.equal(bolIpfs);

    // ── Step 9: Customs clears goods → CUSTOMS_CLEARED ──────────────────
    await docVerification.connect(owner).verifyAsCustoms(0, true, "");
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(7); // CUSTOMS_CLEARED

    // ── Step 10: Importer bank authorizes payment → PAYMENT_AUTHORIZED ──
    await paymentSettlement.connect(issuingBank).authorizePayment(0);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(10); // PAYMENT_AUTHORIZED

    // ── Step 11: Exporter bank confirms settlement → COMPLETED ───────────
    await paymentSettlement.connect(advisingBank).confirmSettlement(0);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(12); // COMPLETED

    const settlement = await paymentSettlement.getSettlement(0);
    expect(settlement.settlementConfirmed).to.equal(true);
  });

  it("Should enforce DUTY_PENDING → DUTY_PAID → CUSTOMS_CLEARED branch", async function () {
    const amount = ethers.parseEther("5");
    const expiry = Math.floor(Date.now() / 1000) + 86400;

    // Setup: get to GOODS_SHIPPED
    await tradeRegistry.connect(importer).createTrade(
      exporter.address, issuingBank.address, advisingBank.address, amount
    );
    await tradeRegistry.connect(importer).confirmTrade(0);
    await tradeRegistry.connect(exporter).confirmTrade(0);
    await tradeRegistry.updateStatus(0, 2); // LOC_INITIATED
    await letterOfCredit.connect(issuingBank).uploadLocDocument(0, expiry, "QmLoC");
    await letterOfCredit.connect(advisingBank).approveLoC(0);
    await letterOfCredit.connect(issuingBank).lockFunds(0);
    await tradeRegistry.connect(importer).assignShippingCompany(0, shipping.address);
    await docVerification.connect(shipping).issueBillOfLading(0, "QmBoL");

    // Customs holds goods → DUTY_PENDING
    await docVerification.connect(owner).verifyAsCustoms(0, false, "");
    let trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(8); // DUTY_PENDING

    // Tax authority records duty payment → DUTY_PAID
    await docVerification.connect(owner).recordDutyPayment(0);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(9); // DUTY_PAID

    // Tax authority releases → CUSTOMS_CLEARED
    await docVerification.connect(owner).releaseFromDuty(0);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(7); // CUSTOMS_CLEARED
  });

  it("Should enforce state transition guards – cannot uploadLoC without LOC_INITIATED", async function () {
    const amount = ethers.parseEther("10");
    const expiry = Math.floor(Date.now() / 1000) + 86400;
    await tradeRegistry.connect(importer).createTrade(
      exporter.address, issuingBank.address, advisingBank.address, amount
    );
    // Still in OFFER_ACCEPTED — must fail
    await expect(
      letterOfCredit.connect(issuingBank).uploadLocDocument(0, expiry, "QmHash")
    ).to.be.revertedWith("Trade must be in LOC_INITIATED status");
  });

  it("Should enforce BoL can only be issued after FUNDS_LOCKED", async function () {
    const amount = ethers.parseEther("10");
    const expiry = Math.floor(Date.now() / 1000) + 86400;
    await tradeRegistry.connect(importer).createTrade(
      exporter.address, issuingBank.address, advisingBank.address, amount
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
});
