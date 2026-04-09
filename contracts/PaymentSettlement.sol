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
    TradeRegistry public immutable tradeRegistry;

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
    modifier onlyIssuingBank(uint256 tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
        require(msg.sender == trade.issuingBank, "Only issuing bank (importer bank)");
        _;
    }

    modifier onlyAdvisingBank(uint256 tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
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
    function authorizePayment(uint256 tradeId) external onlyIssuingBank(tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
        require(
            trade.status == TradeRegistry.TradeStatus.GOODS_RECEIVED,
            "Importer must confirm goods received first"
        );

        Settlement storage s = settlements[tradeId];
        require(!s.paymentAuthorized, "Payment already authorized");

        s.tradeId           = tradeId;
        s.amount            = trade.amount;
        s.paymentAuthorized = true;
        // slither-disable-next-line timestamp
        s.authorizedAt      = block.timestamp;

        // Move event before external call
        emit PaymentAuthorized(tradeId, trade.amount, msg.sender);

        tradeRegistry.updateStatus(tradeId, TradeRegistry.TradeStatus.PAYMENT_AUTHORIZED);
    }

    /**
     * @notice Exporter bank confirms off-chain settlement completed.
     *         Transitions trade to SETTLEMENT_CONFIRMED → COMPLETED.
     */
    function confirmSettlement(uint256 tradeId) external onlyAdvisingBank(tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
        require(
            trade.status == TradeRegistry.TradeStatus.PAYMENT_AUTHORIZED,
            "Payment not yet authorized"
        );

        Settlement storage s = settlements[tradeId];
        require(s.paymentAuthorized, "Payment not authorized on record");
        require(!s.settlementConfirmed, "Settlement already confirmed");

        s.settlementConfirmed = true;
        // slither-disable-next-line timestamp
        s.confirmedAt         = block.timestamp;

        // Move ALL events before ANY external calls for strict Slither compliance
        emit SettlementConfirmed(tradeId, msg.sender);
        emit TradeCompleted(tradeId);

        tradeRegistry.updateStatus(tradeId, TradeRegistry.TradeStatus.SETTLEMENT_CONFIRMED);
        tradeRegistry.updateStatus(tradeId, TradeRegistry.TradeStatus.COMPLETED);
    }

    /**
     * @notice Importer's Bank deposits the trade amount into the contract vault (Escrow).
     */
    function depositEscrow(uint256 tradeId) external payable onlyIssuingBank(tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
        require(msg.value == trade.amount, "Incorrect amount sent");
        require(trade.status == TradeRegistry.TradeStatus.LOC_APPROVED, "LoC not approved yet");

        settlements[tradeId].fundsLocked = true;
        settlements[tradeId].amount = msg.value;

        // Move event before external call
        emit FundsLocked(tradeId, msg.value);

        tradeRegistry.updateStatus(tradeId, TradeRegistry.TradeStatus.FUNDS_LOCKED);
    }

    /**
     * @notice Refund locked escrow back to the Importer Bank on consensus revert.
     */
    function refundImporter(uint256 tradeId) external {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
        require(trade.status == TradeRegistry.TradeStatus.TRADE_REVERTED_BY_CONSENSUS, "Not in reverted status");

        Settlement storage s = settlements[tradeId];
        require(s.fundsLocked, "No funds locked");
        require(!s.refunded, "Already refunded");

        s.refunded = true;
        uint256 amount = s.amount;
        s.amount = 0;

        emit FundsRefunded(tradeId, trade.issuingBank, amount);
        // slither-disable-next-line arbitrary-send-eth
        payable(trade.issuingBank).transfer(amount);
    }

    /**
     * @notice Payout insurance to Exporter if consensus approves insurance claim.
     *         This is triggered when Inspector marks cargo as damaged.
     */
    function payoutInsurance(uint256 tradeId) external {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
        require(trade.status == TradeRegistry.TradeStatus.CLAIM_PAYOUT_APPROVED, "Claim not approved");

        Settlement storage s = settlements[tradeId];
        require(s.fundsLocked, "No funds locked");
        require(!s.refunded, "Already processed");

        s.refunded = true;
        uint256 amount = s.amount;
        s.amount = 0;

        emit InsurancePayout(tradeId, trade.exporter, amount);
        // slither-disable-next-line arbitrary-send-eth
        payable(trade.exporter).transfer(amount);
    }

    /**
     * @notice Read the settlement record for a trade.
     */
    function getSettlement(uint256 tradeId) external view returns (Settlement memory) {
        return settlements[tradeId];
    }
}
