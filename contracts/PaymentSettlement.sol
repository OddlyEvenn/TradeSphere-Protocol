// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TradeRegistry} from "./TradeRegistry.sol";

/**
 * @title PaymentSettlement
 * @dev Manages escrow deposits, payment authorization, settlement confirmation,
 *      refunds on dispute revert, and insurance payouts for damaged cargo.
 *
 * ── Payment Flow ─────────────────────────────────────────────────────────────
 *  1. After CUSTOMS_CLEARED + GOODS_RECEIVED:
 *     Importer bank calls authorizePayment(tradeId) → PAYMENT_AUTHORIZED
 *
 *  2. Off-chain: Bank-to-bank SWIFT/SEPA settlement happens.
 *
 *  3. Exporter bank confirms receipt of funds:
 *     confirmSettlement(tradeId) → SETTLEMENT_CONFIRMED → COMPLETED
 *
 *  4. [If TRADE_REVERTED_BY_CONSENSUS]:
 *     refundImporter(tradeId) → returns escrow funds to Importer Bank
 *
 *  5. [If CLAIM_PAYOUT_APPROVED]:
 *     payoutInsurance(tradeId) → pays escrowed funds to Exporter (insurance claim)
 * ─────────────────────────────────────────────────────────────────────────────
 */
contract PaymentSettlement {
    TradeRegistry public tradeRegistry;

    // ── Structs ────────────────────────────────────────────────────────────
    struct Settlement {
        uint256 tradeId;
        uint256 amount;
        bool    fundsLocked;
        bool    paymentAuthorized;
        bool    settlementConfirmed;
        bool    refunded;
        uint256 authorizedAt;
        uint256 confirmedAt;
    }

    // ── Storage ────────────────────────────────────────────────────────────
    mapping(uint256 => Settlement) public settlements;

    // ── Events ─────────────────────────────────────────────────────────────
    event PaymentAuthorized(uint256 indexed tradeId, uint256 indexed amount, address indexed authorizedBy);
    event SettlementConfirmed(uint256 indexed tradeId, address indexed confirmedBy);
    event TradeCompleted(uint256 indexed tradeId);
    event FundsLocked(uint256 indexed tradeId, uint256 indexed amount);
    event FundsRefunded(uint256 indexed tradeId, address indexed to, uint256 indexed amount);
    event InsurancePayout(uint256 indexed tradeId, address indexed to, uint256 indexed amount);

    // ── Constructor ────────────────────────────────────────────────────────
    constructor(address _tradeRegistry) {
        tradeRegistry = TradeRegistry(_tradeRegistry);
    }

    // ── Modifiers ──────────────────────────────────────────────────────────
    modifier onlyIssuingBank(uint256 _tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(msg.sender == trade.issuingBank, "Only issuing bank (importer bank)");
        _;
    }

    modifier onlyAdvisingBank(uint256 _tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(msg.sender == trade.advisingBank, "Only advising bank (exporter bank)");
        _;
    }

    modifier onlyAuthorized() {
        require(tradeRegistry.authorizedContracts(msg.sender) || msg.sender == tradeRegistry.owner(), "Not authorized");
        _;
    }

    // ── External Functions ─────────────────────────────────────────────────

    /**
     * @notice Importer bank authorizes payment after goods received.
     *         Transitions trade to PAYMENT_AUTHORIZED.
     */
    function authorizePayment(uint256 _tradeId) external onlyIssuingBank(_tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(
            trade.status == TradeRegistry.TradeStatus.GOODS_RECEIVED,
            "Importer must confirm goods received first"
        );

        Settlement storage s = settlements[_tradeId];
        require(!s.paymentAuthorized, "Payment already authorized");

        s.tradeId           = _tradeId;
        s.amount            = trade.amount;
        s.paymentAuthorized = true;
        s.authorizedAt      = block.timestamp;

        tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.PAYMENT_AUTHORIZED);
        emit PaymentAuthorized(_tradeId, trade.amount, msg.sender);
    }

    /**
     * @notice Exporter bank confirms off-chain settlement completed.
     *         Transitions trade to SETTLEMENT_CONFIRMED → COMPLETED.
     */
    function confirmSettlement(uint256 _tradeId) external onlyAdvisingBank(_tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(
            trade.status == TradeRegistry.TradeStatus.PAYMENT_AUTHORIZED,
            "Payment not yet authorized"
        );

        Settlement storage s = settlements[_tradeId];
        require(s.paymentAuthorized, "Payment not authorized on record");
        require(!s.settlementConfirmed, "Settlement already confirmed");

        s.settlementConfirmed = true;
        s.confirmedAt         = block.timestamp;

        tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.SETTLEMENT_CONFIRMED);
        emit SettlementConfirmed(_tradeId, msg.sender);

        tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.COMPLETED);
        emit TradeCompleted(_tradeId);
    }

    /**
     * @notice Importer's Bank deposits the trade amount into the contract vault (Escrow).
     */
    function depositEscrow(uint256 _tradeId) external payable onlyIssuingBank(_tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(msg.value == trade.amount, "Incorrect amount sent");
        require(trade.status == TradeRegistry.TradeStatus.LOC_APPROVED, "LoC not approved yet");

        settlements[_tradeId].fundsLocked = true;
        settlements[_tradeId].amount = msg.value;

        tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.FUNDS_LOCKED);
        emit FundsLocked(_tradeId, msg.value);
    }

    /**
     * @notice Refund locked escrow back to the Importer Bank on consensus revert.
     */
    function refundImporter(uint256 _tradeId) external {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(trade.status == TradeRegistry.TradeStatus.TRADE_REVERTED_BY_CONSENSUS, "Not in reverted status");

        Settlement storage s = settlements[_tradeId];
        require(s.fundsLocked, "No funds locked");
        require(!s.refunded, "Already refunded");

        s.refunded = true;
        uint256 amount = s.amount;
        s.amount = 0;

        payable(trade.issuingBank).transfer(amount);
        emit FundsRefunded(_tradeId, trade.issuingBank, amount);
    }

    /**
     * @notice Payout insurance to Exporter if consensus approves insurance claim.
     *         This is triggered when Inspector marks cargo as damaged.
     */
    function payoutInsurance(uint256 _tradeId) external {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(trade.status == TradeRegistry.TradeStatus.CLAIM_PAYOUT_APPROVED, "Claim not approved");

        Settlement storage s = settlements[_tradeId];
        require(s.fundsLocked, "No funds locked");
        require(!s.refunded, "Already processed");

        s.refunded = true;
        uint256 amount = s.amount;
        s.amount = 0;

        payable(trade.exporter).transfer(amount);
        emit InsurancePayout(_tradeId, trade.exporter, amount);
    }

    /**
     * @notice Read the settlement record for a trade.
     */
    function getSettlement(uint256 _tradeId) external view returns (Settlement memory) {
        return settlements[_tradeId];
    }
}
