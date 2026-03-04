import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("TradeSphere Protocol", function () {
  let tradeRegistry, letterOfCredit, docVerification, paymentSettlement;
  let owner, importer, exporter, issuingBank, advisingBank, customs;

  beforeEach(async function () {
    [owner, importer, exporter, issuingBank, advisingBank, customs] = await ethers.getSigners();

    const TradeRegistry = await ethers.getContractFactory("TradeRegistry");
    tradeRegistry = await TradeRegistry.deploy();

    const LetterOfCredit = await ethers.getContractFactory("LetterOfCredit");
    letterOfCredit = await LetterOfCredit.deploy(await tradeRegistry.getAddress());

    const DocumentVerification = await ethers.getContractFactory("DocumentVerification");
    docVerification = await DocumentVerification.deploy(await tradeRegistry.getAddress(), customs.address);

    const PaymentSettlement = await ethers.getContractFactory("PaymentSettlement");
    paymentSettlement = await PaymentSettlement.deploy(await tradeRegistry.getAddress(), await docVerification.getAddress());

    // Authorize
    await tradeRegistry.setAuthorizedContract(await letterOfCredit.getAddress(), true);
    await tradeRegistry.setAuthorizedContract(await docVerification.getAddress(), true);
    await tradeRegistry.setAuthorizedContract(await paymentSettlement.getAddress(), true);
  });

  it("Should facilitate a full trade lifecycle", async function () {
    const amount = ethers.parseEther("10");
    const expiry = Math.floor(Date.now() / 1000) + 3600;

    // 1. Create Trade
    await tradeRegistry.connect(importer).createTrade(exporter.address, issuingBank.address, advisingBank.address, amount);
    let trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(0); // CREATED

    // 2. Request LoC
    await letterOfCredit.connect(importer).requestLoC(0, expiry);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(1); // LOC_REQUESTED

    // 3. Issue LoC
    await letterOfCredit.connect(issuingBank).issueLoC(0);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(2); // LOC_ISSUED

    // 4. Submit Docs
    const ipfsHash = "QmTest123";
    await docVerification.connect(exporter).submitDocuments(0, ipfsHash);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(3); // DOCS_SUBMITTED

    // 5. Verify (Customs + Bank)
    await docVerification.connect(customs).verifyAsCustoms(0);
    await docVerification.connect(issuingBank).verifyAsBank(0);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(4); // DOCS_VERIFIED

    // 6. Confirm Receipt
    await paymentSettlement.connect(importer).confirmReceipt(0);
    trade = await tradeRegistry.getTrade(0);
    expect(trade.status).to.equal(6); // PAYMENT_AUTHORIZED (Status 5 is GOODS_RECEIVED, but it moves to 6 immediately)
  });

  it("Should prevent unauthorized status updates", async function () {
    // Owner is authorized by default in my logic (msg.sender == owner)
    // But other random users shouldn't be
    await expect(tradeRegistry.connect(importer).updateStatus(0, 1)).to.be.revertedWith("Not authorized");
  });

  it("Should enforce state transition guards", async function () {
    const amount = ethers.parseEther("10");
    await tradeRegistry.connect(importer).createTrade(exporter.address, issuingBank.address, advisingBank.address, amount);
    
    // Cannot issue LoC before request
    await expect(letterOfCredit.connect(issuingBank).issueLoC(0)).to.be.revertedWith("LoC not requested");
  });
});
