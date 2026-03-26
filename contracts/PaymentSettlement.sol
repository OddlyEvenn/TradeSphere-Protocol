// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TradeRegistry.sol";

/**
 * @title PaymentSettlement
 * @dev Manages the final payment authorization and off-chain settlement confirmation.
 *
 * ── Payment Flow ─────────────────────────────────────────────────────────────
 *  1. After CUSTOMS_CLEARED:
 *     Importer bank calls authorizePayment(tradeId) → PAYMENT_AUTHORIZED
 *
 *  2. Off-chain: Bank-to-bank SWIFT/SEPA settlement happens.
 *
 *  3. Exporter bank confirms receipt of funds:
 *     confirmSettlement(tradeId) → SETTLEMENT_CONFIRMED → COMPLETED
 *
 * Note: Actual fund transfer is off-chain (traditional banking). This contract
 *       records the authorization and confirmation events on-chain for the
 *       immutable audit trail visible to all stakeholders (incl. Regulator).
 * ─────────────────────────────────────────────────────────────────────────────
 */
contract PaymentSettlement {
    TradeRegistry public tradeRegistry;

    // ── Structs ────────────────────────────────────────────────────────────
    struct Settlement {
        uint256 tradeId;
        uint256 amount;
        bool    fundsLocked;        // NEW: Actual ETH held in contract
        bool    paymentAuthorized;
        bool    settlementConfirmed;
        bool    refunded;           // NEW: Refunded due to dispute
        uint256 authorizedAt;
        uint256 confirmedAt;
    }

    // ── Storage ────────────────────────────────────────────────────────────
    mapping(uint256 => Settlement) public settlements;

    // ── Events ─────────────────────────────────────────────────────────────
    event PaymentAuthorized(uint256 indexed tradeId, uint256 amount, address authorizedBy);
    event SettlementConfirmed(uint256 indexed tradeId, address confirmedBy);
    event TradeCompleted(uint256 indexed tradeId);
    event FundsLocked(uint256 indexed tradeId, uint256 amount);
    event FundsRefunded(uint256 indexed tradeId, address to, uint256 amount);
    event InsurancePayout(uint256 indexed tradeId, address to, uint256 amount);

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
     * @notice Importer bank authorizes payment after customs clearance.
     *         Transitions trade to PAYMENT_AUTHORIZED.
     *         Off-chain bank settlement will follow after this.
     * @param _tradeId  On-chain trade ID
     */
    function authorizePayment(uint256 _tradeId) external onlyIssuingBank(_tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(
            trade.status == TradeRegistry.TradeStatus.CUSTOMS_CLEARED,
            "Customs must be cleared first"
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
     * @notice Exporter bank confirms that off-chain bank settlement has completed.
     *         Transitions trade to SETTLEMENT_CONFIRMED then immediately to COMPLETED.
     * @param _tradeId  On-chain trade ID
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

        // Transition: PAYMENT_AUTHORIZED → SETTLEMENT_CONFIRMED → COMPLETED
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
     * @notice Refund the locked amount back to the Importer Bank if consensus is reach for revert.
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
     * @notice Payout insurance to Exporter if consensus is reached for insurance claim.
     */
    function payoutInsurance(uint256 _tradeId) external {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(trade.status == TradeRegistry.TradeStatus.CLAIM_PAYOUT_APPROVED, "Claim not approved");

        Settlement storage s = settlements[_tradeId];
        require(s.fundsLocked, "No funds locked");
        require(!s.refunded, "Already processed");

        s.refunded = true; // Mark as processed
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
